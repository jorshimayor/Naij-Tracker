// Shape mirrors the JSON returned by the NestJS API in apps/api/src/bills/bills.service.ts.
// Kept loose by design — we don't share types across the workspace yet to keep coupling low.

export type BillStage =
  | 'INTRODUCED' | 'FIRST_READING' | 'SECOND_READING' | 'COMMITTEE'
  | 'THIRD_READING' | 'PASSED' | 'TRANSMITTED' | 'ASSENTED'
  | 'WITHDRAWN' | 'LAPSED';

export type ExplainerStatus = 'DRAFT' | 'AUTO_APPROVED' | 'PENDING_REVIEW' | 'APPROVED' | 'FLAGGED';

export interface JurisdictionRef {
  slug: string;
  name: string;
  type?: string;
  stateCode?: string | null;
  websiteUrl?: string | null;
}

export interface TopicRef {
  slug: string;
  name: string;
}

export interface LegislatorRef {
  slug: string;
  fullName: string;
  party?: string | null;
  chamber?: string;
  state?: string | null;
  constituency?: string | null;
  photoUrl?: string | null;
  contactEmail?: string | null;
}

export interface BillListItem {
  id: string;
  billNumber: string;
  title: string;
  slug: string;
  summaryShort?: string | null;
  currentStage: BillStage;
  introducedDate?: string;
  lastActionDate?: string;
  sensitiveFlag: boolean;
  jurisdiction: JurisdictionRef;
  primarySponsor?: LegislatorRef;
  sponsorCount: number;
  topics: TopicRef[];
  counts: { comments: number; stageEvents: number };
}

export interface BillListResponse {
  total: number;
  limit: number;
  offset: number;
  results: BillListItem[];
}

export interface ExplainerPayload {
  status: ExplainerStatus;
  visible: boolean;
  version: number;
  language: string;
  requestedLanguage?: string;
  requestedAvailable?: boolean;
  availableLanguages?: string[];
  generatedAt: string;
  modelUsed: string;
  tldr: string | null;
  plainEnglish: string | null;
  howItAffectsYou: string[] | null;
  argumentsFor: string[] | null;
  argumentsAgainst: string[] | null;
  jargonTerms: { term: string; definition: string }[] | null;
  sourceCitations: { label: string; url: string }[] | null;
}

export interface BillDetail {
  id: string;
  billNumber: string;
  title: string;
  slug: string;
  summaryShort?: string | null;
  summaryLong?: string | null;
  fullText?: string | null;
  currentStage: BillStage;
  introducedDate?: string;
  lastActionDate?: string;
  sensitiveFlag: boolean;
  jurisdiction: JurisdictionRef;
  sponsors: { role: 'PRIMARY' | 'CO_SPONSOR'; legislator: LegislatorRef }[];
  topics: (TopicRef & { source: string; confidence?: number })[];
  stageEvents: { stage: BillStage; occurredOn: string; notes?: string | null }[];
  documents: { type: string; url: string; description?: string | null; retrievedAt: string }[];
  indicators?: {
    slug: string;
    name: string;
    pillar: string;
    unitLabel: string;
    relevance: number;
    note: string | null;
  }[];
  explainer: ExplainerPayload | null;
}

export interface BillDetailResponse {
  bill: BillDetail;
  related: {
    billNumber: string;
    title: string;
    slug: string;
    jurisdiction: JurisdictionRef;
    currentStage: BillStage;
    topics: TopicRef[];
  }[];
  duplicates: {
    id: string;
    billNumber: string;
    title: string;
    slug: string;
    jurisdiction: JurisdictionRef;
    currentStage: BillStage;
    similarityPercent: number;
  }[];
}

export interface JurisdictionStats {
  totalBills: number;
  totalSensitive: number;
  byStage: { stage: BillStage; count: number }[];
  byJurisdiction: {
    slug?: string;
    name?: string;
    stateCode?: string | null;
    type?: string;
    count: number;
  }[];
}

export interface TopicDetail {
  slug: string;
  name: string;
  bills: {
    billNumber: string;
    title: string;
    slug: string;
    summaryShort?: string | null;
    currentStage: BillStage;
    lastActionDate?: string;
    jurisdiction: JurisdictionRef;
    primarySponsor?: LegislatorRef;
    confidence?: number;
  }[];
}

export type IndicatorPillar =
  | 'MONEY_PRICES' | 'FX_EXTERNAL' | 'MARKETS' | 'PUBLIC_FINANCE' | 'DEBT' | 'REAL_ECONOMY';

export type IndicatorFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

export interface SourceRef {
  slug: string;
  name: string;
  acronym?: string | null;
  homepageUrl?: string | null;
}

export interface IndicatorListItem {
  slug: string;
  name: string;
  pillar: IndicatorPillar;
  subCategory: string | null;
  unitLabel: string;
  frequency: IndicatorFrequency;
  sensitiveFlag: boolean;
  description: string | null;
  source: SourceRef;
  latest: { date: string; value: number; change: number | null } | null;
  explainerTldr: string | null;
}

export interface IndicatorListResponse {
  total: number;
  results: IndicatorListItem[];
}

export interface IndicatorObservation {
  date: string;
  value: number;
}

export interface IndicatorDetail {
  slug: string;
  name: string;
  pillar: IndicatorPillar;
  subCategory: string | null;
  unit: string;
  unitLabel: string;
  frequency: IndicatorFrequency;
  sensitiveFlag: boolean;
  description: string | null;
  methodologyDoc: string | null;
  source: SourceRef;
  latest: IndicatorObservation | null;
  changeVsPrevious: number | null;
  changeVsYearAgo: number | null;
  observations: IndicatorObservation[];
  explainer: {
    status: ExplainerStatus;
    visible: boolean;
    observationDate: string;
    generatedAt: string;
    modelUsed: string;
    tldr: string | null;
    plainEnglish: string | null;
    whatChanged: string | null;
    howItAffectsYou: string[] | null;
  } | null;
  relatedBills: {
    billNumber: string;
    title: string;
    slug: string;
    currentStage: BillStage;
    jurisdiction: JurisdictionRef;
    relevance: number;
    note: string | null;
  }[];
}

export interface LegislatorDetail {
  slug: string;
  fullName: string;
  party?: string | null;
  chamber: string;
  constituency?: string | null;
  state?: string | null;
  photoUrl?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
  socialLinks?: Record<string, string> | null;
  bills: {
    role: 'PRIMARY' | 'CO_SPONSOR';
    bill: {
      billNumber: string;
      title: string;
      slug: string;
      summaryShort?: string | null;
      currentStage: BillStage;
      lastActionDate?: string;
      jurisdiction: JurisdictionRef;
      topics: TopicRef[];
    };
  }[];
}
