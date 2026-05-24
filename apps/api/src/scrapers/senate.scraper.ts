import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchNassBillsForChamber } from './nass-source';
import type { Scraper, ScrapedBill } from './types';

/**
 * Senate scraper.
 *
 * Live path: hits the NASS DataTables AJAX endpoint at /documents/bill_track/ via the shared
 * `nass-source` module, then filters to chamber === "Senate". One endpoint serves both
 * chambers so RepsScraper shares the cache.
 *
 * Fallback: reads bundled fixtures if USE_LIVE_SOURCES=false or the live fetch fails. The
 * pipeline never silently misses bills.
 *
 * Cap the volume with NASS_MAX_BILLS in .env (default 80). The full set is ~2,600 records.
 */

@Injectable()
export class SenateScraper implements Scraper {
  readonly source = 'senate';
  readonly jurisdictionSlug = 'federal-senate';
  private readonly logger = new Logger(SenateScraper.name);

  async scrape(): Promise<ScrapedBill[]> {
    if (process.env.USE_LIVE_SOURCES === 'true') {
      try {
        const live = await fetchNassBillsForChamber('Senate');
        if (live.length === 0) {
          this.logger.warn('Live Senate scrape returned 0 bills. Falling back to fixtures.');
        } else {
          this.logger.log(`Senate live scrape: ${live.length} bills from nass.gov.ng`);
          return live;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Live Senate scrape failed: ${msg}. Falling back to fixtures.`);
      }
    }
    return this.loadFixtures();
  }

  private async loadFixtures(): Promise<ScrapedBill[]> {
    const path = join(__dirname, '..', '..', '..', '..', 'prisma', 'fixtures', 'senate-bills.json');
    const raw = await readFile(path, 'utf-8');
    const bills = JSON.parse(raw) as ScrapedBill[];
    this.logger.log(`Senate fixture: ${bills.length} bills`);
    return bills;
  }
}
