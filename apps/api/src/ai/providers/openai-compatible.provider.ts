import { Injectable, Logger } from '@nestjs/common';
import type {
  AIProvider,
  ExplainerInput,
  ExplainerOutput,
  TaggerInput,
  TaggerOutput,
  VerifyInput,
  VerifyOutput,
  VerifyVerdict,
  VerifyCheck,
  TranslateExplainerInput,
  TranslateExplainerOutput,
} from './ai-provider.interface';
import { buildExplainerPrompt, buildTaggingPrompt, buildVerifyPrompt, buildTranslatePrompt } from '../prompts/explainer.prompt';

/**
 * OpenAI-API-compatible provider. Works with:
 *   - Groq          (free, no credit card)    https://api.groq.com/openai/v1
 *   - DeepSeek      (free tier)               https://api.deepseek.com/v1
 *   - OpenRouter    (some free models)        https://openrouter.ai/api/v1
 *   - Google Gemini (free tier, OpenAI-compat) https://generativelanguage.googleapis.com/v1beta/openai/
 *   - OpenAI itself                            https://api.openai.com/v1
 *
 * Config (.env):
 *   AI_PROVIDER  = groq | deepseek | openrouter | gemini | openai
 *   AI_API_KEY   = <your key>
 *   AI_BASE_URL  = (optional override)
 *   AI_MODEL     = (optional override)
 */

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
  groq:       { baseUrl: 'https://api.groq.com/openai/v1',                                 model: 'llama-3.3-70b-versatile' },
  deepseek:   { baseUrl: 'https://api.deepseek.com/v1',                                     model: 'deepseek-chat' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1',                                    model: 'meta-llama/llama-3.3-70b-instruct:free' },
  gemini:     { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',         model: 'gemini-2.0-flash' },
  openai:     { baseUrl: 'https://api.openai.com/v1',                                       model: 'gpt-4o-mini' },
};

const SENSITIVE_KEYWORDS = [
  'electoral act', 'inec', 'bvas',
  'lawful interception', 'intelligence agency', 'surveillance', 'national security agencies',
  'sharia', 'religion',
  'ethnic group', 'tribal',
];

interface ChatResponse {
  choices: { message: { content: string } }[];
}

@Injectable()
export class OpenAICompatibleProvider implements AIProvider {
  private readonly logger = new Logger(OpenAICompatibleProvider.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly providerName: string;

  constructor() {
    const provider = (process.env.AI_PROVIDER ?? 'groq').toLowerCase();
    const defaults = PROVIDER_DEFAULTS[provider] ?? PROVIDER_DEFAULTS.groq;
    this.providerName = provider;
    this.baseUrl = (process.env.AI_BASE_URL ?? defaults.baseUrl).replace(/\/$/, '');
    this.model = process.env.AI_MODEL ?? defaults.model;
    this.apiKey = process.env.AI_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? '';
    if (!this.apiKey) {
      this.logger.warn(`${provider} provider has no AI_API_KEY set — calls will fail.`);
    } else {
      this.logger.log(`AI provider: ${provider} model=${this.model}`);
    }
  }

  async generateExplainer(input: ExplainerInput): Promise<ExplainerOutput> {
    const { system, user } = buildExplainerPrompt(input);
    const json = await this.callJson(system, user);
    return this.normalizeExplainer(json, input);
  }

  async translateExplainer(input: TranslateExplainerInput): Promise<TranslateExplainerOutput> {
    const { system, user } = buildTranslatePrompt(input);
    const json = await this.callJson(system, user);
    const arrStr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
    const jargon = Array.isArray(json.jargonTerms)
      ? json.jargonTerms
          .filter((j: any) => j && typeof j.term === 'string' && typeof j.definition === 'string')
          .map((j: any) => ({ term: j.term, definition: j.definition }))
      : [];
    return {
      tldr: typeof json.tldr === 'string' ? json.tldr : input.tldr,
      plainEnglish: typeof json.plainEnglish === 'string' ? json.plainEnglish : input.plainEnglish,
      howItAffectsYou: arrStr(json.howItAffectsYou),
      argumentsFor: arrStr(json.argumentsFor),
      argumentsAgainst: arrStr(json.argumentsAgainst),
      jargonTerms: jargon,
      modelUsed: `${this.providerName}:${this.model}`,
    };
  }

  async verifyExplainer(input: VerifyInput): Promise<VerifyOutput> {
    const { system, user } = buildVerifyPrompt(input);
    const json = await this.callJson(system, user);
    const validVerdicts: VerifyVerdict[] = ['supported', 'partial', 'unsupported', 'unverifiable'];
    const verdict = (v: unknown): VerifyVerdict =>
      validVerdicts.includes(v as VerifyVerdict) ? (v as VerifyVerdict) : 'unverifiable';
    const checks: VerifyCheck[] = Array.isArray(json.checks)
      ? json.checks.map((c: any) => ({
          claimType: (['tldr', 'plain_english', 'impact_bullet'] as const).includes(c?.claimType)
            ? c.claimType
            : 'impact_bullet',
          claim: typeof c?.claim === 'string' ? c.claim : '',
          verdict: verdict(c?.verdict),
          evidence: typeof c?.evidence === 'string' ? c.evidence : '',
          notes: typeof c?.notes === 'string' ? c.notes : '',
        }))
      : [];
    return {
      overallVerdict: verdict(json.overallVerdict),
      summary: typeof json.summary === 'string' ? json.summary : '',
      checks,
      modelUsed: `${this.providerName}:${this.model}`,
    };
  }

  async classifyTopics(input: TaggerInput, taxonomy: { slug: string; name: string }[]): Promise<TaggerOutput> {
    const { system, user } = buildTaggingPrompt(input, taxonomy);
    const json = await this.callJson(system, user);
    const topics = Array.isArray(json.topics) ? json.topics : [];
    const validSlugs = new Set(taxonomy.map((t) => t.slug));
    return {
      topics: topics
        .filter((t: any) => t && typeof t.slug === 'string' && validSlugs.has(t.slug))
        .map((t: any) => ({
          slug: t.slug,
          confidence: typeof t.confidence === 'number' ? Math.max(0, Math.min(1, t.confidence)) : 0.6,
        }))
        .slice(0, 5),
    };
  }

  private async callJson(system: string, userMessage: string): Promise<any> {
    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' as const },
      temperature: 0.3,
      max_tokens: 2000,
    };

    // Retry with exponential backoff on rate limits (429) and transient 5xx errors.
    // Groq free tier in particular has a tight TPM ceiling — we parse "try again in Xs" hints
    // from the error body when present.
    const maxAttempts = 6;
    let lastErr: Error | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = (await res.json()) as ChatResponse;
        const content = data.choices?.[0]?.message?.content ?? '';
        try {
          return JSON.parse(content);
        } catch {
          const stripped = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
          try {
            return JSON.parse(stripped);
          } catch {
            throw new Error(`AI provider ${this.providerName} returned non-JSON: ${content.slice(0, 300)}`);
          }
        }
      }

      const text = await res.text().catch(() => '');
      lastErr = new Error(`AI provider ${this.providerName} returned ${res.status}: ${text.slice(0, 500)}`);

      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt === maxAttempts) break;

      const waitSecHint = parseRetryHint(text, res.headers);
      const backoff = waitSecHint ?? Math.min(2 ** attempt, 30);
      this.logger.warn(`${this.providerName} ${res.status} (attempt ${attempt}/${maxAttempts}); waiting ${backoff.toFixed(1)}s`);
      await new Promise((resolve) => setTimeout(resolve, backoff * 1000));
    }

    throw lastErr ?? new Error(`AI provider ${this.providerName} failed`);
  }

  private normalizeExplainer(raw: any, input: ExplainerInput): ExplainerOutput {
    const haystack = `${input.title}\n${input.fullText}`.toLowerCase();
    const heuristicSensitive = SENSITIVE_KEYWORDS.some((kw) => haystack.includes(kw));

    const tldr = typeof raw.tldr === 'string' ? raw.tldr : input.title;
    const plainEnglish = typeof raw.plainEnglish === 'string' ? raw.plainEnglish : (raw.plain_english ?? '');
    const howItAffectsYou = arrayOfStrings(raw.howItAffectsYou ?? raw.how_it_affects_you);
    const argumentsFor = arrayOfStrings(raw.argumentsFor ?? raw.arguments_for);
    const argumentsAgainst = arrayOfStrings(raw.argumentsAgainst ?? raw.arguments_against);
    const jargonTerms = arrayOfPairs(raw.jargonTerms ?? raw.jargon_terms, 'term', 'definition') as { term: string; definition: string }[];
    const sourceCitations = arrayOfPairs(raw.sourceCitations ?? raw.source_citations, 'label', 'url') as { label: string; url: string }[];
    const modelSensitive = typeof raw.sensitive === 'boolean' ? raw.sensitive : false;

    return {
      tldr,
      plainEnglish,
      howItAffectsYou,
      argumentsFor,
      argumentsAgainst,
      jargonTerms,
      sourceCitations: sourceCitations.length > 0 ? sourceCitations : input.sourceUrls.map((url, i) => ({
        label: i === 0 ? 'Official bill text' : `Source ${i + 1}`,
        url,
      })),
      sensitive: modelSensitive || heuristicSensitive,
      modelUsed: `${this.providerName}:${this.model}`,
    };
  }
}

function parseRetryHint(body: string, headers: Headers): number | null {
  // Standard header
  const retryAfter = headers.get('retry-after');
  if (retryAfter) {
    const sec = parseFloat(retryAfter);
    if (!Number.isNaN(sec) && sec > 0) return Math.min(sec + 0.5, 60);
  }
  // Groq-style hint embedded in the JSON body: "Please try again in 2.55s"
  const m = body.match(/try again in ([\d.]+)s/i);
  if (m) {
    const sec = parseFloat(m[1]);
    if (!Number.isNaN(sec) && sec > 0) return Math.min(sec + 0.5, 60);
  }
  return null;
}

function arrayOfStrings(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

function arrayOfPairs(v: any, k1: string, k2: string): { [k: string]: string }[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => x && typeof x === 'object' && typeof x[k1] === 'string' && typeof x[k2] === 'string')
    .map((x) => ({ [k1]: x[k1], [k2]: x[k2] }));
}
