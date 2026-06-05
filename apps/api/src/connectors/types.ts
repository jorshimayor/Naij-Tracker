/**
 * Canonical shape produced by every economic-indicator connector, regardless of source.
 * The pipeline normalizes and persists records of this shape. The pattern mirrors
 * `apps/api/src/scrapers/types.ts` so connectors and scrapers stay structurally aligned.
 */

export interface ScrapedObservation {
  /** ISO date (YYYY-MM-DD). Period-end date the observation refers to. */
  date: string;
  /** Numeric value in the indicator's canonical unit. */
  value: number;
  /** Optional secondary value for ranges / CI bands (unused in v0). */
  valueSecondary?: number;
}

export interface ScrapedRelease {
  /** Indicator slug this release populates, e.g. "headline-cpi-yoy". */
  indicatorSlug: string;
  /** Source slug, e.g. "nbs". */
  sourceSlug: string;
  /** URL the release was fetched from (or `fixture://...` for bundled data). */
  releaseUrl: string;
  /** Date the source released this batch. */
  releaseDate: string;
  /** Observations in this release. */
  observations: ScrapedObservation[];
  /** True if the data is from a bundled fixture and should be badged as such in the UI. */
  sample: boolean;
}

export interface IndicatorConnector {
  /** Stable id, used in CLI and ingest logs. */
  readonly source: string;
  /** Pull a fresh release. v0 implementations read from fixtures. */
  scrape(): Promise<ScrapedRelease>;
}
