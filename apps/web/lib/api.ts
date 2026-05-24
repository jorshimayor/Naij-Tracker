import type {
  BillDetailResponse,
  BillListResponse,
  JurisdictionStats,
  LegislatorDetail,
  TopicDetail,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    next: { revalidate: 60 },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`API ${res.status} on ${path}: ${await res.text().catch(() => '')}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listBills(params: Record<string, string | undefined>): Promise<BillListResponse> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') qs.set(k, v);
    }
    const search = qs.toString();
    return fetchJson<BillListResponse>(`/api/bills${search ? `?${search}` : ''}`);
  },
  getBill(jurisdiction: string, slug: string, lang?: string): Promise<BillDetailResponse> {
    const qs = lang ? `?lang=${encodeURIComponent(lang)}` : '';
    return fetchJson<BillDetailResponse>(`/api/bills/${jurisdiction}/${slug}${qs}`);
  },
  listTopics(): Promise<{ slug: string; name: string; billCount: number }[]> {
    return fetchJson(`/api/topics`);
  },
  getTopic(slug: string): Promise<TopicDetail> {
    return fetchJson(`/api/topics/${slug}`);
  },
  listLegislators(): Promise<
    { slug: string; fullName: string; party: string | null; chamber: string; constituency: string | null; state: string | null; sponsorshipCount: number }[]
  > {
    return fetchJson(`/api/legislators`);
  },
  getLegislator(slug: string): Promise<LegislatorDetail> {
    return fetchJson(`/api/legislators/${slug}`);
  },
  listJurisdictions(): Promise<
    { slug: string; name: string; type: string; stateCode: string | null; websiteUrl: string | null; billCount: number }[]
  > {
    return fetchJson(`/api/jurisdictions`);
  },
  stats(): Promise<JurisdictionStats> {
    return fetchJson(`/api/jurisdictions/stats`);
  },
  listStates(): Promise<{
    meta: { note: string; lastUpdated: string };
    states: { code: string; name: string; lgaCount: number; lgas: string[] }[];
  }> {
    return fetchJson(`/api/representatives/states`);
  },
  lookupRep(state: string, lga: string): Promise<{
    meta: { note: string; lastUpdated: string };
    state: { code: string; name: string };
    lga: string;
    senator: RepLookupPerson | null;
    representative: RepLookupPerson | null;
    stateAssemblyMember: RepLookupPerson | null;
  }> {
    return fetchJson(`/api/representatives/lookup?state=${encodeURIComponent(state)}&lga=${encodeURIComponent(lga)}`);
  },
};

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
