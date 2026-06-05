/**
 * Shared NASS (Senate + House of Reps) data source.
 *
 * nass.gov.ng's /documents/bills page is a jQuery DataTables shell that pulls rows from
 * /documents/bill_track/ as JSON (server-side processing). One endpoint serves both chambers;
 * we just filter by the `chamber` column in each scraper.
 *
 * Response shape:
 *   {
 *     draw: number,
 *     recordsTotal: number,    // ~2656 at time of writing
 *     recordsFiltered: number,
 *     data: [ [title, chamber, firstReading, secondReading, committee, thirdReading, billId], ... ]
 *   }
 */

import { Logger } from '@nestjs/common';
import { fetchHtml } from './http-client';
import type { ScrapedBill } from './types';

const BASE_URL = 'https://nass.gov.ng/documents/bill_track/';
const BILL_DETAIL_BASE = 'https://nass.gov.ng/documents/bill/';
const PAGE_SIZE = 100;
const CACHE_TTL_MS = 5 * 60_000;

// Cap to avoid blasting 27 pages × 1.5s every dev ingest. Override with NASS_MAX_BILLS env var.
const DEFAULT_MAX_BILLS = 80;

const logger = new Logger('NassSource');

interface CacheEntry {
  fetchedAt: number;
  bills: ScrapedBill[];
}
let cache: CacheEntry | null = null;

interface NassRow {
  0: string;            // title with bill number prefix
  1: string;            // chamber: "Senate" | "House of Representatives"
  2: string | null;     // first reading date
  3: string | null;     // second reading date
  4: string | null;     // committee date
  5: string | null;     // third reading date
  6: number | string;   // bill id (used in detail URL)
}

interface NassResponse {
  draw: number;
  recordsTotal: number;
  recordsFiltered: number;
  data: NassRow[];
}

export async function fetchAllNassBills(): Promise<ScrapedBill[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    logger.log(`Using cached NASS bills (${cache.bills.length}, age ${Math.round((Date.now() - cache.fetchedAt) / 1000)}s)`);
    return cache.bills;
  }

  const maxBills = Number(process.env.NASS_MAX_BILLS ?? DEFAULT_MAX_BILLS);
  const all: ScrapedBill[] = [];
  let start = 0;
  let total = -1;

  while (true) {
    const url = `${BASE_URL}?draw=1&start=${start}&length=${PAGE_SIZE}`;
    // The endpoint inspects X-Requested-With and Referer; without them it returns an empty
    // data array (no error code) which is what caused the earlier silent regression.
    const raw = await fetchHtml(url, {
      skipRobots: true,
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json',
        'Referer': 'https://nass.gov.ng/documents/bills',
      },
    });
    let json: NassResponse;
    try {
      json = JSON.parse(raw) as NassResponse;
    } catch (err) {
      throw new Error(`NASS endpoint returned non-JSON at start=${start}: ${raw.slice(0, 200)}`);
    }
    if (total === -1) {
      total = json.recordsTotal;
      logger.log(`NASS reports ${total} bills total; ingesting up to ${maxBills}`);
    }
    if (!json.data || json.data.length === 0) break;

    for (const row of json.data) {
      const parsed = parseRow(row);
      if (parsed) all.push(parsed);
      if (all.length >= maxBills) break;
    }

    start += PAGE_SIZE;
    if (all.length >= maxBills || start >= total) break;
  }

  cache = { fetchedAt: Date.now(), bills: all };
  return all;
}

export async function fetchNassBillsForChamber(chamberFilter: 'Senate' | 'House of Representatives'): Promise<ScrapedBill[]> {
  const all = await fetchAllNassBills();
  return all.filter((b) => (b as ScrapedBill & { _chamber: string })._chamber === chamberFilter);
}

function parseRow(row: NassRow): (ScrapedBill & { _chamber: string }) | null {
  const titleField = String(row[0] ?? '').trim();
  const chamber = String(row[1] ?? '').trim();
  if (!titleField || !chamber) return null;

  const { billNumber, title } = parseTitle(titleField);
  if (!billNumber || !title) return null;

  const dates: { label: string; date: string | null; stage: string }[] = [
    { label: 'First reading',  date: row[2], stage: 'FIRST_READING' },
    { label: 'Second reading', date: row[3], stage: 'SECOND_READING' },
    { label: 'Committee',      date: row[4], stage: 'COMMITTEE' },
    { label: 'Third reading',  date: row[5], stage: 'THIRD_READING' },
  ];
  const stageEvents = dates
    .filter((d) => d.date)
    .map((d) => ({ stage: d.stage, occurredOn: normalizeDate(d.date!) ?? new Date().toISOString().slice(0, 10) }));
  const introducedDate = stageEvents[0]?.occurredOn ?? new Date().toISOString().slice(0, 10);
  // Current stage = latest non-null reading; fall back to INTRODUCED
  const currentStage = stageEvents.length > 0 ? stageEvents[stageEvents.length - 1].stage : 'INTRODUCED';
  if (stageEvents.length === 0) {
    stageEvents.push({ stage: 'INTRODUCED', occurredOn: introducedDate });
  }

  const detailUrl = `${BILL_DETAIL_BASE}${row[6]}`;

  return {
    billNumber,
    title,
    introducedDate,
    currentStage,
    sponsorSlugs: [], // Sponsor data not in the index; detail-page parse is a future enhancement.
    summaryShort: undefined,
    fullText: '', // Bill text is on the detail page / linked PDF; not fetched in this pass.
    stageEvents,
    documents: [{ type: 'HTML', url: detailUrl, description: 'NASS bill page' }],
    _chamber: chamber,
  };
}

/**
 * Title field looks like: `HB. 1602 National Minimum Wage Bill, 2019 (HB. 1602 )`
 * The bill number appears at the start and again in trailing parens. Strip both.
 */
function parseTitle(raw: string): { billNumber: string; title: string } {
  // Normalise internal whitespace
  const normalised = raw.replace(/\s+/g, ' ').trim();

  // Capture leading bill number (HB./SB./HR./SR. with optional spaces and digits, may have suffix like 2024A)
  const leadMatch = normalised.match(/^([HS][BR]\.?\s*\d+[A-Z]?)\s+(.*)$/i);
  if (!leadMatch) {
    // Fallback: no recognisable prefix — use whole string as title and synthesise a number
    return { billNumber: `BILL-${normalised.slice(0, 12).replace(/[^A-Z0-9]/gi, '')}`, title: normalised };
  }
  const billNumber = leadMatch[1].replace(/\s+/g, '').replace(/\./g, '.');
  let title = leadMatch[2].trim();
  // Strip trailing "(HB. 1602)" / "(SB.123A)" etc.
  title = title.replace(/\(\s*[HS][BR]\.?\s*\d+[A-Z]?\s*\)\s*$/i, '').trim();
  return { billNumber, title };
}

function normalizeDate(raw: string): string | null {
  if (!raw) return null;
  // Strip ordinal suffixes (1st → 1)
  const cleaned = raw.replace(/(\d+)(st|nd|rd|th)/gi, '$1').trim();
  const d = new Date(cleaned);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
