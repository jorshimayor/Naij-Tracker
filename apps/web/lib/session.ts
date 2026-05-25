import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
export const SESSION_COOKIE = 'nbt_session';

export interface MeUser {
  id: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
  whatsappOptIn: boolean;
  role: 'CITIZEN' | 'CONTRIBUTOR' | 'EDITOR' | 'ADMIN';
  createdAt: string;
  lastLoginAt: string | null;
}

export function sessionCookie(): string | undefined {
  return cookies().get(SESSION_COOKIE)?.value;
}

function authHeader(token?: string): HeadersInit {
  return token ? { Cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` } : {};
}

export async function getCurrentUser(): Promise<MeUser | null> {
  const token = sessionCookie();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      cache: 'no-store',
      headers: authHeader(token),
    });
    if (res.status === 401) return null;
    if (!res.ok) return null;
    return (await res.json()) as MeUser;
  } catch (err) {
    // API unreachable — treat as logged-out rather than 500'ing the whole page (e.g. when the
    // API host is still warming up or the env var isn't wired yet).
    console.warn(`[session] getCurrentUser network error: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

export async function requireUser(): Promise<MeUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function sessionFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = sessionCookie();
  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(token),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status} on ${path}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// --- Auth server actions ---

export async function requestOtp(email: string): Promise<{ ok: boolean; throttledSecondsLeft?: number; message?: string }> {
  const res = await fetch(`${API_BASE}/api/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) return { ok: false, message: data?.message ?? 'Failed to send code' };
  if (data?.throttledSecondsLeft) return { ok: false, throttledSecondsLeft: data.throttledSecondsLeft };
  return { ok: true };
}

export async function verifyOtp(email: string, code: string): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as any;
    return { ok: false, message: data?.message ?? 'Code rejected' };
  }
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    // Extract just the token value and re-set on our origin so the browser carries it.
    const m = setCookie.match(/nbt_session=([^;]+)/);
    if (m) {
      cookies().set(SESSION_COOKIE, decodeURIComponent(m[1]), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    }
  }
  return { ok: true };
}

export async function logout(): Promise<void> {
  const token = sessionCookie();
  if (token) {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: authHeader(token),
    }).catch(() => {});
  }
  cookies().delete(SESSION_COOKIE);
}

// --- Subscriptions ---

export interface SubscriptionRow {
  id: string;
  targetType: 'BILL' | 'SPONSOR' | 'TOPIC' | 'CHAMBER';
  targetId: string;
  channel: 'EMAIL' | 'WHATSAPP' | 'BOTH';
  frequency: 'REALTIME' | 'DAILY' | 'WEEKLY';
  createdAt: string;
  label: string;
  href: string | null;
}

export async function listSubscriptions(): Promise<SubscriptionRow[]> {
  return sessionFetch<SubscriptionRow[]>('/api/subscriptions');
}

export async function isFollowing(
  targetType: 'BILL' | 'SPONSOR' | 'TOPIC' | 'CHAMBER',
  targetId: string,
): Promise<boolean> {
  const token = sessionCookie();
  if (!token) return false;
  try {
    const r = await sessionFetch<{ following: boolean }>(
      `/api/subscriptions/check?targetType=${targetType}&targetId=${encodeURIComponent(targetId)}`,
    );
    return r.following;
  } catch {
    return false;
  }
}

export async function follow(targetType: 'BILL' | 'SPONSOR' | 'TOPIC' | 'CHAMBER', targetId: string) {
  return sessionFetch('/api/subscriptions', {
    method: 'POST',
    body: JSON.stringify({ targetType, targetId, channel: 'EMAIL', frequency: 'REALTIME' }),
  });
}

export async function unfollow(subscriptionId: string) {
  return sessionFetch(`/api/subscriptions/${subscriptionId}`, { method: 'DELETE' });
}

// --- Contributions ---

export interface ContributionRow {
  id: string;
  billNumber: string;
  title: string;
  summary: string | null;
  sourceUrl: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';
  reviewerNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  publishedBillId: string | null;
  jurisdiction: { slug: string; name: string };
}

export async function listMyContributions(): Promise<ContributionRow[]> {
  return sessionFetch<ContributionRow[]>('/api/contributions/mine');
}

export async function submitContribution(input: {
  jurisdictionSlug: string;
  billNumber: string;
  title: string;
  summary?: string;
  sourceUrl?: string;
  fullText?: string;
  submitterNote?: string;
}) {
  return sessionFetch('/api/contributions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// --- Comments ---

export interface CommentRow {
  id: string;
  body: string;
  status: 'VISIBLE' | 'HIDDEN' | 'PENDING_MODERATION';
  parentId: string | null;
  createdAt: string;
  author: { id: string; name: string; isYou: boolean };
}

export async function listComments(billId: string): Promise<CommentRow[]> {
  const token = sessionCookie();
  const res = await fetch(`${API_BASE}/api/comments?billId=${encodeURIComponent(billId)}`, {
    cache: 'no-store',
    headers: token ? { Cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` } : {},
  });
  if (!res.ok) return [];
  return res.json() as Promise<CommentRow[]>;
}

export async function postComment(billId: string, body: string) {
  return sessionFetch(`/api/comments`, {
    method: 'POST',
    body: JSON.stringify({ billId, body }),
  });
}

export async function deleteOwnComment(commentId: string) {
  return sessionFetch(`/api/comments/${commentId}`, { method: 'DELETE' });
}
