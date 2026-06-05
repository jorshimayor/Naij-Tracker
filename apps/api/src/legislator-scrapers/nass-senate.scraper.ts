import { Injectable, Logger } from '@nestjs/common';
import type { LegislatorScraper, ScrapedLegislator } from './types';

/**
 * Senate scraper for nass.gov.ng.
 *
 * The /mps/senators page is a DataTables shell that pulls rows from /mps/get_legislators/
 * as JSON. Pattern is identical to the bill-tracker DataTables endpoint:
 *   GET /mps/get_legislators/?chamber=1&draw=1&start=0&length=200
 *   => { draw, recordsTotal, recordsFiltered, data: [[name, state, district, party, mp_id], …] }
 * Chamber 1 = Senate, 2 = House of Representatives (handled in a sibling scraper).
 *
 * Coverage caveat: the endpoint returns 74 rows as of the time of writing — the published
 * list does not include the full 109. We import what's available; the missing ~35 will
 * appear as empty Senators sections on the relevant state pages until NASS publishes them.
 */

const ENDPOINT = 'https://nass.gov.ng/mps/get_legislators/';
const PHOTO_BASE = 'https://nass.gov.ng/themes/newnass/images/mps/';
const PROFILE_BASE = 'https://nass.gov.ng/mps/single/';

interface NassLegislatorResponse {
  draw: number;
  recordsTotal: number;
  recordsFiltered: number;
  data: [string, string, string, string, string][];
}

@Injectable()
export class NassSenateScraper implements LegislatorScraper {
  readonly source = 'nass-senate';
  private readonly logger = new Logger(NassSenateScraper.name);

  async scrape(): Promise<ScrapedLegislator[]> {
    const url = `${ENDPOINT}?chamber=1&draw=1&start=0&length=500`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'NaijaBillTracker/0.1 (+https://naijabilltracker.com.ng)',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json',
        'Referer': 'https://nass.gov.ng/mps/senators',
      },
    });
    if (!res.ok) {
      throw new Error(`NASS senators endpoint returned ${res.status}`);
    }
    const json = (await res.json()) as NassLegislatorResponse;
    this.logger.log(`NASS senators: ${json.data.length} rows (recordsTotal=${json.recordsTotal})`);

    return json.data
      .filter((row) => row[0] && row[1] && row[4])
      .map((row): ScrapedLegislator => {
        const [name, state, district, party, mpId] = row;
        return {
          upstreamId: String(mpId),
          fullName: cleanName(name),
          chamber: 'federal-senate',
          state: state.trim(),
          constituency: district.trim(),
          party: party?.trim() || null,
          photoUrl: `${PHOTO_BASE}${mpId}.jpg`,
          profileUrl: `${PROFILE_BASE}${mpId}`,
        };
      });
  }
}

function cleanName(raw: string): string {
  // NASS data has the occasional double-space ("Jibrin  Isah") and trailing whitespace.
  return raw.replace(/\s+/g, ' ').trim();
}
