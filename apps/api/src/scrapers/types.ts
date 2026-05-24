/**
 * Canonical shape produced by every scraper, regardless of source. The pipeline normalizes
 * and persists records of this shape. New scrapers (Reps, Lagos HoA, etc.) emit the same type.
 */
export interface ScrapedBill {
  /** Stable identifier within the source (e.g., "SB.142", "HB.0204"). */
  billNumber: string;
  title: string;
  introducedDate: string;
  currentStage: string;
  /** Slugs of legislators known to be in the seed; the pipeline looks them up. */
  sponsorSlugs: string[];
  summaryShort?: string;
  fullText: string;
  stageEvents: ScrapedStageEvent[];
  documents: ScrapedDocument[];
}

export interface ScrapedStageEvent {
  stage: string;
  occurredOn: string;
  notes?: string;
}

export interface ScrapedDocument {
  type: string;
  url: string;
  description?: string;
}

export interface Scraper {
  /** Stable id, used in CLI and ingest logs. */
  readonly source: string;
  /** Slug of the Jurisdiction the bills belong to. Must match a seeded jurisdiction. */
  readonly jurisdictionSlug: string;
  /** Pull a fresh batch of bills. v0 implementations read from fixtures. */
  scrape(): Promise<ScrapedBill[]>;
}
