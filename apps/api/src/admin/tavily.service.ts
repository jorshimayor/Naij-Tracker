import { Injectable, Logger } from '@nestjs/common';

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
}

interface TavilyResponse {
  results?: { title: string; url: string; content: string; score: number; published_date?: string }[];
  answer?: string;
  query?: string;
}

/**
 * Thin wrapper around https://api.tavily.com/search.
 *
 * Used by the admin verifier to surface external press/analysis links related to a bill, so an
 * editor can cross-check the AI-generated explainer against the public record. Bill-text grounding
 * (the existing AI verification pass) remains primary.
 */
@Injectable()
export class TavilyService {
  private readonly logger = new Logger(TavilyService.name);

  isConfigured(): boolean {
    return !!process.env.TAVILY_API_KEY;
  }

  async search(query: string, maxResults = 5): Promise<TavilyResult[]> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      this.logger.warn('TAVILY_API_KEY not set — returning no external sources');
      return [];
    }

    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: maxResults,
          search_depth: 'basic',
          include_answer: false,
          include_raw_content: false,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(`Tavily returned ${res.status}: ${text.slice(0, 300)}`);
        return [];
      }
      const data = (await res.json()) as TavilyResponse;
      return (data.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score,
        publishedDate: r.published_date,
      }));
    } catch (err) {
      this.logger.warn(`Tavily call failed: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  buildQuery(input: { billNumber: string; title: string }): string {
    const stripped = input.title
      .replace(/^A Bill for an Act to\s*/i, '')
      .replace(/^A Bill for a Law to\s*/i, '')
      .replace(/,?\s*and for (Related|Connected) (Matters|Purposes)\.?$/i, '')
      .slice(0, 120);
    return `Nigeria ${input.billNumber} ${stripped}`;
  }
}
