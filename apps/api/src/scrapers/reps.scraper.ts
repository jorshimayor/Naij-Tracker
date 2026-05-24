import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchNassBillsForChamber } from './nass-source';
import type { Scraper, ScrapedBill } from './types';

/**
 * House of Representatives scraper. Shares the NASS DataTables endpoint with SenateScraper —
 * the underlying request is cached so running both scrapers back-to-back makes one HTTP call.
 */

@Injectable()
export class RepsScraper implements Scraper {
  readonly source = 'reps';
  readonly jurisdictionSlug = 'federal-reps';
  private readonly logger = new Logger(RepsScraper.name);

  async scrape(): Promise<ScrapedBill[]> {
    if (process.env.USE_LIVE_SOURCES === 'true') {
      try {
        const live = await fetchNassBillsForChamber('House of Representatives');
        if (live.length === 0) {
          this.logger.warn('Live Reps scrape returned 0 bills. Falling back to fixtures.');
        } else {
          this.logger.log(`Reps live scrape: ${live.length} bills from nass.gov.ng`);
          return live;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Live Reps scrape failed: ${msg}. Falling back to fixtures.`);
      }
    }
    return this.loadFixtures();
  }

  private async loadFixtures(): Promise<ScrapedBill[]> {
    const path = join(__dirname, '..', '..', '..', '..', 'prisma', 'fixtures', 'reps-bills.json');
    const raw = await readFile(path, 'utf-8');
    const bills = JSON.parse(raw) as ScrapedBill[];
    this.logger.log(`Reps fixture: ${bills.length} bills`);
    return bills;
  }
}
