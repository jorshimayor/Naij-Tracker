/**
 * Canonical shape produced by every legislator scraper. Mirrors the ScrapedBill pattern
 * in apps/api/src/scrapers/types.ts.
 */

export interface ScrapedLegislator {
  /** Stable upstream id (e.g. NASS "mp_id" 513). Used to derive photo URL + detect dupes. */
  upstreamId: string;
  fullName: string;
  /** Chamber slug aligned with Jurisdiction.slug — "federal-senate" or "federal-reps". */
  chamber: 'federal-senate' | 'federal-reps' | string;
  /** Canonical Nigerian state name as it appears in lib/data/states.ts. */
  state: string;
  /** Constituency: senatorial district for senators, federal constituency for reps. */
  constituency: string;
  party: string | null;
  /** Absolute URL to the official portrait, if any. */
  photoUrl: string | null;
  /** Profile URL on the source site, if any. */
  profileUrl: string | null;
}

export interface LegislatorScraper {
  /** Stable id, used in CLI and ingest logs. */
  readonly source: string;
  /** Pull a fresh batch. */
  scrape(): Promise<ScrapedLegislator[]>;
}
