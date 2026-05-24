import { PrismaClient, JurisdictionType } from '@prisma/client';
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

async function main() {
  console.log('Seeding reference data...');
  await seedJurisdictions();
  await seedTopics();
  await seedLegislators();
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
