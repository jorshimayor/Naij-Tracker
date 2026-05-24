import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: join(__dirname, '..', '..', '..', '..', '.env') });

import { MockClaudeProvider } from '../ai/providers/mock-claude.provider';
import { ClaudeProvider } from '../ai/providers/claude.provider';
import { OpenAICompatibleProvider } from '../ai/providers/openai-compatible.provider';
import type { AIProvider } from '../ai/providers/ai-provider.interface';
import { ExplainerService } from '../ai/explainer.service';
import { TaggerService } from '../ai/tagger.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PipelineService } from '../scrapers/pipeline.service';
import { SenateScraper } from '../scrapers/senate.scraper';
import { RepsScraper } from '../scrapers/reps.scraper';
import { LagosScraper } from '../scrapers/lagos.scraper';
import type { Scraper } from '../scrapers/types';

const OPENAI_COMPAT = new Set(['groq', 'deepseek', 'openrouter', 'gemini', 'openai']);

function pickAiProvider(): AIProvider {
  const choice = (process.env.AI_PROVIDER ?? 'mock').toLowerCase();
  if (choice === 'claude') {
    console.log('AI provider: Claude (live)');
    return new ClaudeProvider();
  }
  if (OPENAI_COMPAT.has(choice)) {
    console.log(`AI provider: ${choice} via OpenAI-compatible API`);
    return new OpenAICompatibleProvider();
  }
  console.log(`AI provider: ${choice} (using MockClaudeProvider)`);
  return new MockClaudeProvider();
}

function pickScrapers(arg: string): Scraper[] {
  switch (arg) {
    case 'senate': return [new SenateScraper()];
    case 'reps':   return [new RepsScraper()];
    case 'lagos':  return [new LagosScraper()];
    case 'all':    return [new SenateScraper(), new RepsScraper(), new LagosScraper()];
    default:
      console.error(`Unknown source: ${arg}. Available: senate, reps, lagos, all`);
      process.exit(1);
  }
}

async function main() {
  const target = process.argv[2] ?? 'senate';
  const scrapers = pickScrapers(target);

  const prisma = new PrismaClient();
  const ai = pickAiProvider();

  // Cast to any: services are @Injectable() decorated but here we instantiate them directly,
  // so the Nest DI decorators on parameters are inert. This is intentional — the CLI is a
  // separate entry point that doesn't need an application context.
  const explainer = new ExplainerService(prisma as any, ai);
  const tagger = new TaggerService(prisma as any, ai);
  const emailSvc = new EmailService(prisma as any);
  const notifications = new NotificationsService(prisma as any, emailSvc);
  const pipeline = new PipelineService(prisma as any, explainer, tagger, notifications);

  let hadErrors = false;
  for (const scraper of scrapers) {
    console.log(`\n=== Ingesting source: ${scraper.source} → ${scraper.jurisdictionSlug} ===`);
    const scraped = await scraper.scrape();
    const summary = await pipeline.ingest(scraper.source, scraper.jurisdictionSlug, scraped);
    console.log(JSON.stringify(summary, null, 2));
    if (summary.errors.length > 0) hadErrors = true;
  }

  await prisma.$disconnect();
  if (hadErrors) {
    console.error('\nIngest completed with errors.');
    process.exit(2);
  }
  console.log('\nIngest complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
