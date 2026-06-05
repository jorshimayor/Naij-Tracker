export interface ExplainerInput {
  billNumber: string;
  title: string;
  jurisdictionName: string;
  sponsors: string[];
  fullText: string;
  summaryShort?: string;
  sourceUrls: string[];
}

export interface ExplainerOutput {
  tldr: string;
  plainEnglish: string;
  howItAffectsYou: string[];
  argumentsFor: string[];
  argumentsAgainst: string[];
  jargonTerms: { term: string; definition: string }[];
  sourceCitations: { label: string; url: string }[];
  /** If true, the explainer requires human review before public display (PRD §6.4.2). */
  sensitive: boolean;
  /** Model identifier (e.g., "mock-claude-v0", "claude-sonnet-4-6"). Stored on the AIExplainer row. */
  modelUsed: string;
}

export interface TaggerInput {
  title: string;
  fullText: string;
  summary?: string;
}

export interface TaggerOutput {
  topics: { slug: string; confidence: number }[];
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');

export interface VerifyInput {
  billNumber: string;
  title: string;
  fullText: string;
  tldr: string;
  plainEnglish: string;
  howItAffectsYou: string[];
}

export type VerifyVerdict = 'supported' | 'partial' | 'unsupported' | 'unverifiable';

export interface VerifyCheck {
  claimType: 'tldr' | 'plain_english' | 'impact_bullet';
  claim: string;
  verdict: VerifyVerdict;
  evidence: string;
  notes: string;
}

export interface VerifyOutput {
  overallVerdict: VerifyVerdict;
  summary: string;
  checks: VerifyCheck[];
  modelUsed: string;
}

export interface TranslateExplainerInput {
  billNumber: string;
  billTitle: string;
  /** Source language code (always 'en' today). */
  sourceLanguage: string;
  /** Target ISO code: 'yo' | 'ig' | 'ha' | 'pcm'. */
  targetLanguage: string;
  /** Human-friendly target language name for the prompt: "Yoruba", "Igbo", "Hausa", "Nigerian Pidgin". */
  targetLanguageName: string;
  tldr: string;
  plainEnglish: string;
  howItAffectsYou: string[];
  argumentsFor: string[];
  argumentsAgainst: string[];
  jargonTerms: { term: string; definition: string }[];
}

export interface TranslateExplainerOutput {
  tldr: string;
  plainEnglish: string;
  howItAffectsYou: string[];
  argumentsFor: string[];
  argumentsAgainst: string[];
  jargonTerms: { term: string; definition: string }[];
  modelUsed: string;
}

export interface IndicatorExplainerInput {
  /** Indicator slug, e.g. "headline-cpi-yoy". */
  indicatorSlug: string;
  indicatorName: string;
  /** Pillar enum value as a string, e.g. "MONEY_PRICES". */
  pillar: string;
  /** Unit label shown next to values in the UI, e.g. "% YoY". */
  unitLabel: string;
  /** One-line description of what the indicator measures. */
  description: string;
  /** Source's official name, e.g. "National Bureau of Statistics". */
  sourceName: string;
  /** Observations in ascending date order; the last entry is the latest. */
  observations: { date: string; value: number }[];
}

export interface IndicatorExplainerOutput {
  /** One sentence for citizens; appears in cards and hero. */
  tldr: string;
  /** ~150-word plain-English description of what the indicator means right now. */
  plainEnglish: string;
  /** What moved in the latest period and the most likely drivers (factual, no speculation). */
  whatChanged: string;
  /** 3-5 bullets contextualized to common Nigerian roles (worker, parent, trader, civil servant). */
  howItAffectsYou: string[];
  /** True if this release requires human editorial sign-off before public display. */
  sensitive: boolean;
  modelUsed: string;
}

export interface AIProvider {
  generateExplainer(input: ExplainerInput): Promise<ExplainerOutput>;
  classifyTopics(input: TaggerInput, taxonomy: { slug: string; name: string }[]): Promise<TaggerOutput>;
  verifyExplainer(input: VerifyInput): Promise<VerifyOutput>;
  translateExplainer(input: TranslateExplainerInput): Promise<TranslateExplainerOutput>;
  /**
   * Generate a plain-English explainer for an economic indicator release (PRD §6.4.1).
   * Strict contract: must not invent numeric values that are not in `observations`.
   */
  explainIndicator(input: IndicatorExplainerInput): Promise<IndicatorExplainerOutput>;
}
