import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const ADMIN_COOKIE = 'nbt_admin';

/**
 * Read the admin cookie from the Next.js request, or redirect to /admin/login.
 * Use this at the top of every protected admin page.
 */
export function requireAdminCookie(): string {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token) redirect('/admin/login');
  return token;
}

/** Forward the admin cookie to the backend API. */
function authHeaders(token: string): HeadersInit {
  return { Cookie: `${ADMIN_COOKIE}=${encodeURIComponent(token)}` };
}

export async function adminFetch<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const token = init?.token ?? requireAdminCookie();
  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) redirect('/admin/login');
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Admin API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export async function loginToAdmin(token: string): Promise<boolean> {
  // Validate the token against the backend before setting our cookie.
  const res = await fetch(`${API_BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) return false;
  cookies().set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60,
    path: '/',
  });
  return true;
}

export function logoutFromAdmin() {
  cookies().delete(ADMIN_COOKIE);
}

// ---- API types ----

export interface QueueItem {
  billId: string;
  billNumber: string;
  title: string;
  slug: string;
  jurisdiction: { slug: string; name: string };
  currentStage: string;
  sensitiveFlag: boolean;
  lastActionDate: string | null;
  sponsor: string | null;
  explainer: {
    id: string;
    status: 'DRAFT' | 'AUTO_APPROVED' | 'PENDING_REVIEW' | 'APPROVED' | 'FLAGGED';
    verifiedAt: string | null;
    generatedAt: string;
    modelUsed: string;
    tldr: string;
    reviewerNote: string | null;
  } | null;
}

export interface BillForReview {
  id: string;
  billNumber: string;
  title: string;
  slug: string;
  summaryShort: string | null;
  fullText: string | null;
  currentStage: string;
  sensitiveFlag: boolean;
  introducedDate: string | null;
  lastActionDate: string | null;
  jurisdiction: { slug: string; name: string; type: string };
  sponsors: { role: string; legislator: { slug: string; fullName: string; party: string | null } }[];
  topics: { topic: { slug: string; name: string }; confidence: number | null }[];
  stageEvents: { stage: string; occurredOn: string; notes: string | null }[];
  documents: { type: string; url: string; description: string | null }[];
  explainers: {
    id: string;
    version: number;
    language: string;
    status: string;
    modelUsed: string;
    generatedAt: string;
    reviewedAt: string | null;
    reviewerNote: string | null;
    verifiedAt: string | null;
    tldr: string;
    plainEnglish: string;
    howItAffectsYou: string[];
    argumentsFor: string[];
    argumentsAgainst: string[];
    jargonTerms: { term: string; definition: string }[];
    sourceCitations: { label: string; url: string }[];
    verification: VerificationResult | null;
  }[];
}

export interface VerificationCheck {
  claimType: 'tldr' | 'plain_english' | 'impact_bullet';
  claim: string;
  verdict: 'supported' | 'partial' | 'unsupported' | 'unverifiable';
  evidence: string;
  notes: string;
}

export interface ExternalSource {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
}

export interface VerificationResult {
  overallVerdict: 'supported' | 'partial' | 'unsupported' | 'unverifiable';
  summary: string;
  checks: VerificationCheck[];
  modelUsed: string;
  externalSources?: ExternalSource[];
  externalSearchEnabled?: boolean;
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}
