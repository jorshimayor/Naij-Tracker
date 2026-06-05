import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ScrapedLegislator } from './types';

export interface LegislatorIngestSummary {
  source: string;
  scraped: number;
  created: number;
  updated: number;
  errors: { upstreamId: string; error: string }[];
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

@Injectable()
export class LegislatorPipelineService {
  private readonly logger = new Logger(LegislatorPipelineService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ingest(source: string, scraped: ScrapedLegislator[]): Promise<LegislatorIngestSummary> {
    const summary: LegislatorIngestSummary = {
      source,
      scraped: scraped.length,
      created: 0,
      updated: 0,
      errors: [],
    };

    // Pre-load existing slugs so we can disambiguate collisions deterministically.
    const existingSlugs = new Set(
      (await this.prisma.legislator.findMany({ select: { slug: true } })).map((l) => l.slug),
    );

    for (const leg of scraped) {
      try {
        const baseSlug = slugify(leg.fullName);
        // Disambiguate on collision by appending the state code, then by upstream id.
        let slug = baseSlug;
        const tryWithState = `${baseSlug}-${slugify(leg.state)}`;
        const tryWithId = `${baseSlug}-${leg.upstreamId}`;
        // Look up the existing legislator (if any) that already owns the base slug.
        // If it's the same upstream person (same source+id reflected by chamber+constituency
        // match) we keep the slug; otherwise we move to a disambiguated variant.
        const existingAtBase = await this.prisma.legislator.findUnique({
          where: { slug: baseSlug },
        });
        if (
          existingAtBase &&
          !(
            existingAtBase.chamber === leg.chamber &&
            existingAtBase.constituency?.toLowerCase() === leg.constituency.toLowerCase()
          )
        ) {
          slug = existingSlugs.has(tryWithState) ? tryWithId : tryWithState;
        }

        const data = {
          fullName: leg.fullName,
          chamber: leg.chamber,
          state: leg.state,
          constituency: leg.constituency,
          party: leg.party,
          photoUrl: leg.photoUrl,
        };
        const result = await this.prisma.legislator.upsert({
          where: { slug },
          create: { slug, ...data },
          update: data,
        });
        existingSlugs.add(result.slug);
        if (existingAtBase && existingAtBase.id === result.id) {
          summary.updated++;
        } else if (await wasExisting(this.prisma, slug, leg.upstreamId, result.id)) {
          summary.updated++;
        } else {
          summary.created++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        summary.errors.push({ upstreamId: leg.upstreamId, error: message });
        this.logger.error(`Failed to upsert legislator ${leg.fullName} (${leg.upstreamId}): ${message}`);
      }
    }

    this.logger.log(
      `Ingested ${source}: scraped=${summary.scraped}, created=${summary.created}, updated=${summary.updated}, errors=${summary.errors.length}`,
    );
    return summary;
  }
}

// Helper: distinguishing created vs updated is informational only. We do an after-the-fact
// check on whether the legislator was created within the last few seconds. Not perfect but
// avoids a separate findUnique-before-upsert round trip.
async function wasExisting(prisma: any, slug: string, upstreamId: string, id: string): Promise<boolean> {
  const leg = await prisma.legislator.findUnique({
    where: { id },
    select: { createdAt: true },
  });
  if (!leg) return false;
  return Date.now() - new Date(leg.createdAt).getTime() > 5000;
}
