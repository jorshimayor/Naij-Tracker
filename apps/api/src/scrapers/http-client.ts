import { Logger } from '@nestjs/common';

const USER_AGENT = 'NaijaBillTracker/1.0 (+https://naijabilltracker.com.ng/about)';
const TIMEOUT_MS = 20_000;
const MIN_DELAY_MS = 1500; // polite spacing between requests to the same host

const logger = new Logger('HttpClient');
const lastFetchByHost = new Map<string, number>();
const robotsByHost = new Map<string, RobotsRules | 'pending'>();

interface RobotsRules {
  // We only model the bits we care about — `User-agent: *` disallow rules.
  disallowed: string[];
  fetchedAt: number;
}

export interface FetchOptions {
  maxAttempts?: number;
  /** Force-skip robots.txt for known-friendly URLs (e.g., paginated index pages). */
  skipRobots?: boolean;
}

export async function fetchHtml(url: string, opts: FetchOptions = {}): Promise<string> {
  const u = new URL(url);
  if (!opts.skipRobots && !(await isAllowed(u))) {
    throw new Error(`robots.txt disallows ${u.pathname} on ${u.host}`);
  }
  await rateLimit(u.host);

  const maxAttempts = opts.maxAttempts ?? 3;
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml' },
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timer);
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} for ${url}`);
        if (res.status >= 500 && attempt < maxAttempts) {
          await sleep(1000 * attempt);
          continue;
        }
        throw lastErr;
      }
      return await res.text();
    } catch (err) {
      clearTimeout(timer);
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts) {
        logger.warn(`fetch attempt ${attempt}/${maxAttempts} failed for ${url}: ${lastErr.message}`);
        await sleep(1000 * attempt);
        continue;
      }
    }
  }
  throw lastErr ?? new Error(`fetch failed for ${url}`);
}

async function isAllowed(u: URL): Promise<boolean> {
  const cached = robotsByHost.get(u.host);
  if (cached === 'pending') return true; // assume allowed while we're loading
  const now = Date.now();
  if (!cached || now - cached.fetchedAt > 24 * 3600_000) {
    robotsByHost.set(u.host, 'pending');
    try {
      const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
      const res = await fetch(robotsUrl, { headers: { 'User-Agent': USER_AGENT } });
      const text = res.ok ? await res.text() : '';
      robotsByHost.set(u.host, { disallowed: parseDisallow(text), fetchedAt: now });
    } catch {
      robotsByHost.set(u.host, { disallowed: [], fetchedAt: now });
    }
  }
  const rules = robotsByHost.get(u.host);
  if (!rules || rules === 'pending') return true;
  return !rules.disallowed.some((path) => u.pathname.startsWith(path));
}

function parseDisallow(robotsTxt: string): string[] {
  const disallow: string[] = [];
  let inStar = false;
  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;
    const [keyRaw, valueRaw] = line.split(':');
    if (!keyRaw || valueRaw === undefined) continue;
    const key = keyRaw.trim().toLowerCase();
    const value = valueRaw.trim();
    if (key === 'user-agent') {
      inStar = value === '*';
      continue;
    }
    if (inStar && key === 'disallow' && value) {
      disallow.push(value);
    }
  }
  return disallow;
}

async function rateLimit(host: string): Promise<void> {
  const last = lastFetchByHost.get(host) ?? 0;
  const wait = MIN_DELAY_MS - (Date.now() - last);
  if (wait > 0) await sleep(wait);
  lastFetchByHost.set(host, Date.now());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
