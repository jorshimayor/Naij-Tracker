import type {
  BillDetailResponse,
  BillListResponse,
  JurisdictionStats,
  LegislatorDetail,
  TopicDetail,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Generic fetch helper that returns a `fallback` value when the API is unreachable or returns a
 * non-OK status. This is what keeps the production site rendering ("coming soon" empty states)
 * even when the API hasn't been deployed yet or is temporarily down. Errors are logged so we
 * still notice them in Vercel logs.
 */
async function safeFetchJson<T>(path: string, fallback: T, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 60 },
      ...init,
    });
    if (!res.ok) {
      console.warn(`[api] ${res.status} on ${path} — returning fallback`);
      return fallback;
    }
    return (await res.json()) as T;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[api] network error on ${path}: ${msg} — returning fallback`);
    return fallback;
  }
}

// Empty/default shapes used when the API is unreachable.
const EMPTY_BILLS: BillListResponse = { total: 0, limit: 0, offset: 0, results: [] };
const EMPTY_STATS: JurisdictionStats = {
  totalBills: 0,
  totalSensitive: 0,
  byStage: [],
  byJurisdiction: [],
};
const EMPTY_STATES = {
  meta: { note: '', lastUpdated: '' },
  states: [] as { code: string; name: string; lgaCount: number; lgas: string[] }[],
};

export const api = {
  listBills(params: Record<string, string | undefined>): Promise<BillListResponse> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') qs.set(k, v);
    }
    const search = qs.toString();
    return safeFetchJson(`/api/bills${search ? `?${search}` : ''}`, EMPTY_BILLS);
  },

  // Detail endpoints intentionally still throw on miss — they're rendered via notFound() and
  // a real 404 is the correct UX when a specific bill / topic / legislator can't be resolved.
  getBill(jurisdiction: string, slug: string, lang?: string): Promise<BillDetailResponse> {
    const qs = lang ? `?lang=${encodeURIComponent(lang)}` : '';
    return strictFetchJson<BillDetailResponse>(`/api/bills/${jurisdiction}/${slug}${qs}`);
  },

  listTopics(): Promise<{ slug: string; name: string; billCount: number }[]> {
    return safeFetchJson(`/api/topics`, []);
  },
  getTopic(slug: string): Promise<TopicDetail> {
    return strictFetchJson<TopicDetail>(`/api/topics/${slug}`);
  },

  listLegislators(): Promise<
    { slug: string; fullName: string; party: string | null; chamber: string; constituency: string | null; state: string | null; sponsorshipCount: number }[]
  > {
    return safeFetchJson(`/api/legislators`, []);
  },
  getLegislator(slug: string): Promise<LegislatorDetail> {
    return strictFetchJson<LegislatorDetail>(`/api/legislators/${slug}`);
  },

  listJurisdictions(): Promise<
    { slug: string; name: string; type: string; stateCode: string | null; websiteUrl: string | null; billCount: number }[]
  > {
    return safeFetchJson(`/api/jurisdictions`, []);
  },
  stats(): Promise<JurisdictionStats> {
    return safeFetchJson(`/api/jurisdictions/stats`, EMPTY_STATS);
  },
  listStates(): Promise<{
    meta: { note: string; lastUpdated: string };
    states: { code: string; name: string; lgaCount: number; lgas: string[] }[];
  }> {
    return safeFetchJson(`/api/representatives/states`, EMPTY_STATES);
  },
  lookupRep(state: string, lga: string): Promise<{
    meta: { note: string; lastUpdated: string };
    state: { code: string; name: string };
    lga: string;
    senator: RepLookupPerson | null;
    representative: RepLookupPerson | null;
    stateAssemblyMember: RepLookupPerson | null;
  }> {
    return strictFetchJson(
      `/api/representatives/lookup?state=${encodeURIComponent(state)}&lga=${encodeURIComponent(lga)}`,
    );
  },
};

/**
 * Strict version of fetchJson — throws on any failure. Used by detail-page endpoints where the
 * caller wants Next.js's notFound() to fire on a 404 (rather than rendering empty state).
 */
async function strictFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, { next: { revalidate: 60 }, ...init });
  if (!res.ok) {
    throw new Error(`API ${res.status} on ${path}: ${await res.text().catch(() => '')}`);
  }
  return (await res.json()) as T;
}

export interface RepLookupPerson {
  slug: string;
  fullName: string;
  party: string | null;
  chamber: string;
  constituency: string | null;
  state: string | null;
  contactEmail: string | null;
  recentBills: {
    billNumber: string;
    title: string;
    slug: string;
    currentStage: string;
    jurisdiction: { slug: string; name: string };
  }[];
}
