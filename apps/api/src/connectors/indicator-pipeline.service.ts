import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { IndicatorExplainerService } from '../ai/indicator-explainer.service';
import type { ScrapedRelease } from './types';

function hashRelease(release: ScrapedRelease): string {
  const payload = JSON.stringify({
    url: release.releaseUrl,
    date: release.releaseDate,
    obs: release.observations,
  });
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

export interface IndicatorIngestSummary {
  source: string;
  indicatorSlug: string;
  observationsScraped: number;
  created: number;
  updated: number;
  explainer: 'generated' | 'unchanged' | 'pending-review' | 'no-observations' | 'error';
  errors: string[];
}

@Injectable()
export class IndicatorPipelineService {
  private readonly logger = new Logger(IndicatorPipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly explainer: IndicatorExplainerService,
  ) {}

  async ingest(connectorName: string, release: ScrapedRelease): Promise<IndicatorIngestSummary> {
    const summary: IndicatorIngestSummary = {
      source: connectorName,
      indicatorSlug: release.indicatorSlug,
      observationsScraped: release.observations.length,
      created: 0,
      updated: 0,
      explainer: 'error',
      errors: [],
    };

    const indicator = await this.prisma.indicator.findUnique({
      where: { slug: release.indicatorSlug },
      include: { source: true },
    });
    if (!indicator) {
      const msg = `Indicator "${release.indicatorSlug}" not found. Run \`npm run db:seed\` first.`;
      summary.errors.push(msg);
      throw new Error(msg);
    }
    if (indicator.source.slug !== release.sourceSlug) {
      summary.errors.push(
        `Release source "${release.sourceSlug}" does not match indicator source "${indicator.source.slug}". Continuing anyway.`,
      );
    }

    const contentHash = hashRelease(release);
    const sourceRelease = await this.prisma.sourceRelease.create({
      data: {
        sourceId: indicator.sourceId,
        releaseDate: new Date(release.releaseDate),
        releaseUrl: release.releaseUrl,
        contentHash,
        sample: release.sample,
      },
    });

    for (const obs of release.observations) {
      try {
        const date = new Date(obs.date);
        const existing = await this.prisma.observation.findUnique({
          where: { indicatorId_date: { indicatorId: indicator.id, date } },
        });
        if (existing) {
          // Only "revise" if the value actually changed; otherwise keep the original ingestedAt.
          if (Number(existing.value) !== obs.value) {
            await this.prisma.observation.update({
              where: { id: existing.id },
              data: {
                value: obs.value,
                valueSecondary: obs.valueSecondary,
                releaseId: sourceRelease.id,
                revisionOf: existing.id,
              },
            });
            summary.updated++;
          }
        } else {
          await this.prisma.observation.create({
            data: {
              indicatorId: indicator.id,
              date,
              value: obs.value,
              valueSecondary: obs.valueSecondary,
              releaseId: sourceRelease.id,
            },
          });
          summary.created++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        summary.errors.push(`obs ${obs.date}: ${msg}`);
        this.logger.warn(`Failed to persist observation ${release.indicatorSlug}@${obs.date}: ${msg}`);
      }
    }

    try {
      const result = await this.explainer.generateForIndicator(indicator.id);
      if (result.skipped === 'no-observations') summary.explainer = 'no-observations';
      else if (result.skipped === 'up-to-date') summary.explainer = 'unchanged';
      else if (result.sensitive) summary.explainer = 'pending-review';
      else summary.explainer = 'generated';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`explainer: ${msg}`);
      this.logger.error(`Failed to generate explainer for ${release.indicatorSlug}: ${msg}`);
    }

    this.logger.log(
      `Ingested ${release.indicatorSlug}: created=${summary.created}, updated=${summary.updated}, explainer=${summary.explainer}, errors=${summary.errors.length}`,
    );
    return summary;
  }
}
