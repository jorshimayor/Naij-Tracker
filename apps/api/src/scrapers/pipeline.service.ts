import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ExplainerService } from '../ai/explainer.service';
import { TaggerService } from '../ai/tagger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BillStage, SourceDocumentType, SponsorRole } from '@prisma/client';
import type { ScrapedBill } from './types';

function slugify(input: string, fallback: string): string {
  const slug = input
    .toLowerCase()
    .replace(/^a bill for an act to\s*/i, '')
    .replace(/,?\s*and for related matters\.?$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || fallback.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function hashContent(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function toBillStage(s: string): BillStage {
  const v = s.toUpperCase() as BillStage;
  if (!(v in BillStage)) throw new Error(`Unknown bill stage: ${s}`);
  return v;
}

function toDocType(s: string): SourceDocumentType {
  const v = s.toUpperCase() as SourceDocumentType;
  if (!(v in SourceDocumentType)) throw new Error(`Unknown document type: ${s}`);
  return v;
}

export interface IngestSummary {
  source: string;
  scraped: number;
  created: number;
  updated: number;
  explainers: number;
  sensitive: number;
  errors: { billNumber: string; error: string }[];
}

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly explainer: ExplainerService,
    private readonly tagger: TaggerService,
    private readonly notifications: NotificationsService,
  ) {}

  async ingest(source: string, jurisdictionSlug: string, scraped: ScrapedBill[]): Promise<IngestSummary> {
    const jurisdiction = await this.prisma.jurisdiction.findUnique({ where: { slug: jurisdictionSlug } });
    if (!jurisdiction) {
      throw new Error(`Jurisdiction "${jurisdictionSlug}" not found. Run \`npm run db:seed\` first.`);
    }

    const summary: IngestSummary = {
      source,
      scraped: scraped.length,
      created: 0,
      updated: 0,
      explainers: 0,
      sensitive: 0,
      errors: [],
    };

    for (const raw of scraped) {
      try {
        const result = await this.persistBill(jurisdiction.id, raw);
        if (result.created) summary.created++;
        else summary.updated++;

        const { explainerId, sensitive } = await this.explainer.generateForBill(result.billId);
        if (explainerId) summary.explainers++;
        if (sensitive) summary.sensitive++;

        await this.tagger.tagBill(result.billId);

        // Fire stage-change notifications for existing bills whose current stage moved.
        if (!result.created && result.previousStage && result.previousStage !== result.newStage) {
          await this.notifications
            .notifyBillStageChange({
              billId: result.billId,
              oldStage: result.previousStage,
              newStage: result.newStage,
              note: 'Detected during scraper ingest.',
            })
            .catch((err) => this.logger.warn(`Notification failed for ${raw.billNumber}: ${err}`));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to ingest ${raw.billNumber}: ${message}`);
        summary.errors.push({ billNumber: raw.billNumber, error: message });
      }
    }

    this.logger.log(
      `Ingested ${source}: scraped=${summary.scraped}, created=${summary.created}, updated=${summary.updated}, explainers=${summary.explainers}, sensitive=${summary.sensitive}, errors=${summary.errors.length}`,
    );
    return summary;
  }

  private async persistBill(
    jurisdictionId: string,
    raw: ScrapedBill,
  ): Promise<{ billId: string; created: boolean; previousStage: BillStage | null; newStage: BillStage }> {
    const slug = slugify(raw.title, raw.billNumber);
    const contentHash = hashContent(raw.fullText);
    const lastActionDate =
      raw.stageEvents.length > 0
        ? new Date(raw.stageEvents[raw.stageEvents.length - 1].occurredOn)
        : new Date(raw.introducedDate);

    const existing = await this.prisma.bill.findUnique({
      where: { jurisdictionId_billNumber: { jurisdictionId, billNumber: raw.billNumber } },
    });

    const bill = await this.prisma.bill.upsert({
      where: { jurisdictionId_billNumber: { jurisdictionId, billNumber: raw.billNumber } },
      create: {
        jurisdictionId,
        billNumber: raw.billNumber,
        title: raw.title,
        slug,
        currentStage: toBillStage(raw.currentStage),
        introducedDate: new Date(raw.introducedDate),
        lastActionDate,
        summaryShort: raw.summaryShort,
        fullText: raw.fullText,
        contentHash,
      },
      update: {
        title: raw.title,
        slug,
        currentStage: toBillStage(raw.currentStage),
        introducedDate: new Date(raw.introducedDate),
        lastActionDate,
        summaryShort: raw.summaryShort,
        fullText: raw.fullText,
        contentHash,
      },
    });

    await this.prisma.billStageEvent.deleteMany({ where: { billId: bill.id } });
    if (raw.stageEvents.length > 0) {
      await this.prisma.billStageEvent.createMany({
        data: raw.stageEvents.map((e) => ({
          billId: bill.id,
          stage: toBillStage(e.stage),
          occurredOn: new Date(e.occurredOn),
          notes: e.notes,
        })),
      });
    }

    const wantedSponsors = await this.prisma.legislator.findMany({
      where: { slug: { in: raw.sponsorSlugs } },
      select: { id: true, slug: true },
    });
    await this.prisma.billSponsor.deleteMany({ where: { billId: bill.id } });
    if (wantedSponsors.length > 0) {
      await this.prisma.billSponsor.createMany({
        data: wantedSponsors.map((leg, i) => ({
          billId: bill.id,
          legislatorId: leg.id,
          role: i === 0 ? SponsorRole.PRIMARY : SponsorRole.CO_SPONSOR,
        })),
        skipDuplicates: true,
      });
    }
    const missing = raw.sponsorSlugs.filter((s) => !wantedSponsors.find((w) => w.slug === s));
    if (missing.length > 0) {
      this.logger.warn(`Bill ${raw.billNumber} references unknown sponsor slugs: ${missing.join(', ')}`);
    }

    for (const doc of raw.documents) {
      const url = doc.url;
      const existingDoc = await this.prisma.sourceDocument.findFirst({
        where: { billId: bill.id, url },
      });
      if (existingDoc) {
        await this.prisma.sourceDocument.update({
          where: { id: existingDoc.id },
          data: {
            type: toDocType(doc.type),
            description: doc.description,
            retrievedAt: new Date(),
          },
        });
      } else {
        await this.prisma.sourceDocument.create({
          data: {
            billId: bill.id,
            type: toDocType(doc.type),
            url,
            description: doc.description,
          },
        });
      }
    }

    return {
      billId: bill.id,
      created: !existing,
      previousStage: existing?.currentStage ?? null,
      newStage: bill.currentStage,
    };
  }
}
