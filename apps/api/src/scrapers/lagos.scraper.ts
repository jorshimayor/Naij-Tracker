import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import { fetchHtml } from './http-client';
import type { Scraper, ScrapedBill } from './types';

const LAGOS_INDEX_URL = 'https://lagoshouseofassembly.gov.ng/bills';

// TODO: confirm against the live Lagos State House of Assembly site.
const SELECTORS = {
  billRows: 'table tbody tr, .bill-item, article',
  billNumberInRow: 'td:nth-child(1), .bill-number',
  titleInRow: 'td:nth-child(2) a, .bill-title a, h3 a',
  dateInRow: 'td:nth-child(3), .bill-date',
  stageInRow: 'td:nth-child(4), .bill-stage',
};

@Injectable()
export class LagosScraper implements Scraper {
  readonly source = 'lagos';
  readonly jurisdictionSlug = 'lagos-state-hoa';
  private readonly logger = new Logger(LagosScraper.name);

  async scrape(): Promise<ScrapedBill[]> {
    if (process.env.USE_LIVE_SOURCES === 'true') {
      try {
        const live = await this.scrapeLive();
        if (live.length === 0) {
          this.logger.warn('Live Lagos scrape returned 0 bills — selectors likely stale. Falling back to fixtures.');
        } else {
          this.logger.log(`Lagos live scrape: ${live.length} bills`);
          return live;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Live Lagos scrape failed: ${msg}. Falling back to fixtures.`);
      }
    }
    return this.loadFixtures();
  }

  private async scrapeLive(): Promise<ScrapedBill[]> {
    const html = await fetchHtml(LAGOS_INDEX_URL);
    const $ = cheerio.load(html);

    const bills: ScrapedBill[] = [];
    $(SELECTORS.billRows).each((_, el) => {
      const $row = $(el);
      const billNumber = $row.find(SELECTORS.billNumberInRow).first().text().trim();
      const title = $row.find(SELECTORS.titleInRow).first().text().trim();
      const detailUrl = $row.find(SELECTORS.titleInRow).first().attr('href') ?? null;
      const dateText = $row.find(SELECTORS.dateInRow).first().text().trim();
      const stageText = $row.find(SELECTORS.stageInRow).first().text().trim();

      if (!billNumber || !title) return;

      bills.push({
        billNumber,
        title,
        introducedDate: parseDateLoose(dateText) ?? new Date().toISOString().slice(0, 10),
        currentStage: normalizeStage(stageText),
        sponsorSlugs: [],
        summaryShort: undefined,
        fullText: '',
        stageEvents: [
          {
            stage: normalizeStage(stageText),
            occurredOn: parseDateLoose(dateText) ?? new Date().toISOString().slice(0, 10),
          },
        ],
        documents: detailUrl
          ? [{ type: 'HTML', url: absolutize(detailUrl, LAGOS_INDEX_URL), description: 'Lagos HoA bill page' }]
          : [],
      });
    });
    return bills;
  }

  private async loadFixtures(): Promise<ScrapedBill[]> {
    const path = join(__dirname, '..', '..', '..', '..', 'prisma', 'fixtures', 'lagos-bills.json');
    const raw = await readFile(path, 'utf-8');
    const bills = JSON.parse(raw) as ScrapedBill[];
    this.logger.log(`Lagos fixture: ${bills.length} bills`);
    return bills;
  }
}

function parseDateLoose(s: string): string | null {
  if (!s) return null;
  const cleaned = s.replace(/(\d+)(st|nd|rd|th)/gi, '$1').trim();
  const d = new Date(cleaned);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function normalizeStage(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('assent')) return 'ASSENTED';
  if (s.includes('transmit')) return 'TRANSMITTED';
  if (s.includes('passed') || s.includes('third reading')) return 'PASSED';
  if (s.includes('committee')) return 'COMMITTEE';
  if (s.includes('second reading')) return 'SECOND_READING';
  if (s.includes('first reading')) return 'FIRST_READING';
  if (s.includes('withdraw')) return 'WITHDRAWN';
  if (s.includes('lapse')) return 'LAPSED';
  return 'INTRODUCED';
}

function absolutize(href: string, base: string): string {
  try { return new URL(href, base).toString(); } catch { return href; }
}
