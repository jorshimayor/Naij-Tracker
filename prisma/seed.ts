import { PrismaClient, JurisdictionType, IndicatorPillar, IndicatorFrequency } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();

type JurisdictionFixture = {
  slug: string;
  name: string;
  type: keyof typeof JurisdictionType;
  stateCode?: string;
  websiteUrl?: string;
};

type TopicFixture = { slug: string; name: string };

type LegislatorFixture = {
  slug: string;
  fullName: string;
  party?: string;
  chamber: string;
  constituency?: string;
  state?: string;
  contactEmail?: string;
};

type SourceFixture = {
  slug: string;
  name: string;
  acronym?: string;
  homepageUrl?: string;
  description?: string;
};

type IndicatorFixture = {
  slug: string;
  name: string;
  pillar: keyof typeof IndicatorPillar;
  subCategory?: string;
  unit: string;
  unitLabel: string;
  frequency: keyof typeof IndicatorFrequency;
  sourceSlug: string;
  description?: string;
  methodologyDoc?: string;
  sensitiveFlag?: boolean;
};

type ObservationsFixture = {
  _meta?: { releaseDate?: string };
  indicators: {
    slug: string;
    observations: { date: string; value: number }[];
  }[];
};

type BillIndicatorLinkFixture = {
  billNumber: string;
  indicatorSlug: string;
  relevance?: number;
  note?: string;
};

function loadFixture<T>(name: string): T {
  const path = join(__dirname, 'fixtures', name);
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

async function seedJurisdictions() {
  const fixtures = loadFixture<JurisdictionFixture[]>('jurisdictions.json');
  for (const j of fixtures) {
    await prisma.jurisdiction.upsert({
      where: { slug: j.slug },
      update: { name: j.name, type: j.type, stateCode: j.stateCode, websiteUrl: j.websiteUrl },
      create: j,
    });
  }
  console.log(`  - Seeded ${fixtures.length} jurisdictions`);
}

async function seedTopics() {
  const fixtures = loadFixture<TopicFixture[]>('topics.json');
  for (const t of fixtures) {
    await prisma.topic.upsert({
      where: { slug: t.slug },
      update: { name: t.name },
      create: t,
    });
  }
  console.log(`  - Seeded ${fixtures.length} topics`);
}

async function seedLegislators() {
  const fixtures = loadFixture<LegislatorFixture[]>('legislators.json');
  for (const l of fixtures) {
    await prisma.legislator.upsert({
      where: { slug: l.slug },
      update: {
        fullName: l.fullName,
        party: l.party,
        chamber: l.chamber,
        constituency: l.constituency,
        state: l.state,
        contactEmail: l.contactEmail,
      },
      create: l,
    });
  }
  console.log(`  - Seeded ${fixtures.length} legislators`);
}

async function seedSources() {
  const fixtures = loadFixture<SourceFixture[]>('sources.json');
  for (const s of fixtures) {
    await prisma.source.upsert({
      where: { slug: s.slug },
      update: { name: s.name, acronym: s.acronym, homepageUrl: s.homepageUrl, description: s.description },
      create: s,
    });
  }
  console.log(`  - Seeded ${fixtures.length} sources`);
}

async function seedIndicators() {
  const fixtures = loadFixture<IndicatorFixture[]>('indicators.json');
  const sources = await prisma.source.findMany({ select: { id: true, slug: true } });
  const sourceBySlug = new Map(sources.map((s) => [s.slug, s.id]));
  for (const i of fixtures) {
    const sourceId = sourceBySlug.get(i.sourceSlug);
    if (!sourceId) {
      console.warn(`  ! Indicator ${i.slug} references unknown source ${i.sourceSlug}, skipping`);
      continue;
    }
    const { sourceSlug, sensitiveFlag, ...rest } = i;
    await prisma.indicator.upsert({
      where: { slug: i.slug },
      update: { ...rest, sourceId, sensitiveFlag: sensitiveFlag ?? false },
      create: { ...rest, sourceId, sensitiveFlag: sensitiveFlag ?? false },
    });
  }
  console.log(`  - Seeded ${fixtures.length} indicators`);
}

/**
 * Seed sample observations directly into the database (no AI explainer generation). This is for
 * "decorative" indicators — the ones that aren't the focus of an end-to-end pipeline demo but
 * still need data so the dashboard tiles render. CPI is intentionally NOT seeded here; it flows
 * through the real ingestion pipeline via `npm run ingest:cpi`.
 */
async function seedSampleObservations() {
  const fixture = loadFixture<ObservationsFixture>('indicator-observations.json');
  const indicators = await prisma.indicator.findMany({ select: { id: true, slug: true, sourceId: true } });
  const byIndicator = new Map(indicators.map((i) => [i.slug, i]));
  const releaseDate = new Date(fixture._meta?.releaseDate ?? new Date().toISOString().slice(0, 10));
  let observationCount = 0;
  let skipped = 0;

  for (const block of fixture.indicators) {
    const ind = byIndicator.get(block.slug);
    if (!ind) {
      console.warn(`  ! Observations block references unknown indicator ${block.slug}`);
      skipped++;
      continue;
    }
    // One synthetic release per indicator. Marked sample=true so the UI can badge it.
    const release = await prisma.sourceRelease.create({
      data: {
        sourceId: ind.sourceId,
        releaseDate,
        releaseUrl: `fixture://seed/${block.slug}`,
        sample: true,
      },
    });
    for (const obs of block.observations) {
      await prisma.observation.upsert({
        where: { indicatorId_date: { indicatorId: ind.id, date: new Date(obs.date) } },
        update: { value: obs.value, releaseId: release.id },
        create: { indicatorId: ind.id, date: new Date(obs.date), value: obs.value, releaseId: release.id },
      });
      observationCount++;
    }
  }
  console.log(`  - Seeded ${observationCount} sample observations across ${fixture.indicators.length - skipped} indicators`);
}

/**
 * Seed curated bill ↔ indicator links from the fixture. Idempotent. Missing bills are silently
 * skipped: bills are loaded by the ingest CLI separately, so the seed can run before the bill
 * ingest has happened and just not populate links yet. Re-run after `npm run ingest:senate`
 * (etc.) to backfill.
 */
async function seedBillIndicatorLinks() {
  const fixtures = loadFixture<BillIndicatorLinkFixture[]>('bill-indicator-links.json');
  const bills = await prisma.bill.findMany({ select: { id: true, billNumber: true } });
  const indicators = await prisma.indicator.findMany({ select: { id: true, slug: true } });
  const billByNumber = new Map(bills.map((b) => [b.billNumber, b.id]));
  const indicatorBySlug = new Map(indicators.map((i) => [i.slug, i.id]));

  let linked = 0;
  let skipped = 0;
  for (const link of fixtures) {
    const billId = billByNumber.get(link.billNumber);
    const indicatorId = indicatorBySlug.get(link.indicatorSlug);
    if (!billId || !indicatorId) {
      skipped++;
      continue;
    }
    await prisma.billIndicatorLink.upsert({
      where: { billId_indicatorId: { billId, indicatorId } },
      update: { relevance: link.relevance ?? 0.5, note: link.note, source: 'fixture' },
      create: { billId, indicatorId, relevance: link.relevance ?? 0.5, note: link.note, source: 'fixture' },
    });
    linked++;
  }
  const reason = skipped > 0 ? ` (${skipped} skipped — bill or indicator not yet in DB)` : '';
  console.log(`  - Seeded ${linked} bill ↔ indicator link${linked === 1 ? '' : 's'}${reason}`);
}

async function main() {
  console.log('Seeding reference data...');
  await seedJurisdictions();
  await seedTopics();
  await seedLegislators();
  await seedSources();
  await seedIndicators();
  await seedSampleObservations();
  await seedBillIndicatorLinks();
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
