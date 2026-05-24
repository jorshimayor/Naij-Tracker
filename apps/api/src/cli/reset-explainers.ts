import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: join(__dirname, '..', '..', '..', '..', '.env') });

/**
 * Wipe AI explainers and unset all sensitive flags so the next ingest regenerates everything
 * from scratch with the current provider logic. Useful when you change the mock heuristics.
 */
async function main() {
  const prisma = new PrismaClient();
  const explainers = await prisma.aIExplainer.deleteMany({});
  const bills = await prisma.bill.updateMany({ data: { sensitiveFlag: false } });
  const billTopics = await prisma.billTopic.deleteMany({});
  console.log(`Deleted ${explainers.count} explainers, cleared ${bills.count} sensitive flags, removed ${billTopics.count} topic links.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
