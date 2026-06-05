import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: join(__dirname, '..', '..', '..', '..', '.env') });

import { MockClaudeProvider } from '../ai/providers/mock-claude.provider';
import { ClaudeProvider } from '../ai/providers/claude.provider';
import { OpenAICompatibleProvider } from '../ai/providers/openai-compatible.provider';
import type { AIProvider } from '../ai/providers/ai-provider.interface';
import { IndicatorExplainerService } from '../ai/indicator-explainer.service';
import { IndicatorPipelineService } from '../connectors/indicator-pipeline.service';
import { CpiConnector } from '../connectors/cpi.connector';
import type { IndicatorConnector } from '../connectors/types';

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

function pickConnectors(arg: string): IndicatorConnector[] {
  switch (arg) {
    case 'cpi':
      return [new CpiConnector()];
    case 'all':
      return [new CpiConnector()];
    default:
      console.error(`Unknown economy source: ${arg}. Available: cpi, all`);
      process.exit(1);
  }
}

async function main() {
  const target = process.argv[2] ?? 'cpi';
  const connectors = pickConnectors(target);

  const prisma = new PrismaClient();
  const ai = pickAiProvider();

  // Direct instantiation (no Nest container) — matches the pattern in cli/ingest.ts.
  const explainer = new IndicatorExplainerService(prisma as any, ai);
  const pipeline = new IndicatorPipelineService(prisma as any, explainer);

  let hadErrors = false;
  for (const connector of connectors) {
    console.log(`\n=== Ingesting indicator source: ${connector.source} ===`);
    const release = await connector.scrape();
    const summary = await pipeline.ingest(connector.source, release);
    console.log(JSON.stringify(summary, null, 2));
    if (summary.errors.length > 0) hadErrors = true;
  }

  await prisma.$disconnect();
  if (hadErrors) {
    console.error('\nEconomy ingest completed with errors.');
    process.exit(2);
  }
  console.log('\nEconomy ingest complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
