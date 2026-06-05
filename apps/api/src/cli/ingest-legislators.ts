import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: join(__dirname, '..', '..', '..', '..', '.env') });

import { NassSenateScraper } from '../legislator-scrapers/nass-senate.scraper';
import { LegislatorPipelineService } from '../legislator-scrapers/legislator-pipeline.service';
import type { LegislatorScraper } from '../legislator-scrapers/types';

function pickScrapers(arg: string): LegislatorScraper[] {
  switch (arg) {
    case 'senators': return [new NassSenateScraper()];
    case 'all':      return [new NassSenateScraper()];
    default:
      console.error(`Unknown source: ${arg}. Available: senators, all`);
      process.exit(1);
  }
}

async function main() {
  const target = process.argv[2] ?? 'senators';
  const scrapers = pickScrapers(target);

  const prisma = new PrismaClient();
  const pipeline = new LegislatorPipelineService(prisma as any);

  let hadErrors = false;
  for (const scraper of scrapers) {
    console.log(`\n=== Ingesting legislator source: ${scraper.source} ===`);
    const scraped = await scraper.scrape();
    const summary = await pipeline.ingest(scraper.source, scraped);
    console.log(JSON.stringify(summary, null, 2));
    if (summary.errors.length > 0) hadErrors = true;
  }

  await prisma.$disconnect();
  if (hadErrors) {
    console.error('\nLegislator ingest completed with errors.');
    process.exit(2);
  }
  console.log('\nLegislator ingest complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
