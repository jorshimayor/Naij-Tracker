import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { IndicatorConnector, ScrapedRelease } from './types';

/**
 * Headline CPI (YoY) connector.
 *
 * v0 reads from a bundled fixture. The live path would hit nigerianstat.gov.ng — NBS publishes
 * CPI as a PDF + Excel each month; a real implementation parses the Excel and reconciles against
 * the prior release's revisions. Slot the live fetch in here; the rest of the pipeline does not
 * change.
 */

interface CpiFixtureFile {
  _meta: {
    indicatorSlug: string;
    sourceSlug: string;
    releaseUrl: string;
    releaseDate: string;
  };
  observations: { date: string; value: number }[];
}

@Injectable()
export class CpiConnector implements IndicatorConnector {
  readonly source = 'cpi-nbs';
  private readonly logger = new Logger(CpiConnector.name);

  async scrape(): Promise<ScrapedRelease> {
    const path = join(__dirname, '..', '..', '..', '..', 'prisma', 'fixtures', 'cpi-observations.json');
    const raw = await readFile(path, 'utf-8');
    const data = JSON.parse(raw) as CpiFixtureFile;
    this.logger.log(`CPI fixture: ${data.observations.length} observations`);
    return {
      indicatorSlug: data._meta.indicatorSlug,
      sourceSlug: data._meta.sourceSlug,
      releaseUrl: data._meta.releaseUrl,
      releaseDate: data._meta.releaseDate,
      observations: data.observations,
      sample: true,
    };
  }
}
