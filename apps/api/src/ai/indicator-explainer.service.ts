import { Injectable, Inject, Logger } from '@nestjs/common';
import { ExplainerStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AI_PROVIDER,
  type AIProvider,
  type IndicatorExplainerInput,
} from './providers/ai-provider.interface';

@Injectable()
export class IndicatorExplainerService {
  private readonly logger = new Logger(IndicatorExplainerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
  ) {}

  /**
   * Generate (or regenerate) an explainer for the latest observation on an indicator.
   * Idempotent on (indicatorId, observationDate): if an explainer already exists for the same
   * latest observation, the existing record is returned.
   *
   * Sensitive indicators (debt-service-to-revenue, parallel-FX, anything flagged by the model)
   * land with status=PENDING_REVIEW and are not shown publicly until an editor signs off.
   */
  async generateForIndicator(indicatorId: string): Promise<{
    explainerId: string | null;
    sensitive: boolean;
    skipped?: 'no-observations' | 'up-to-date';
  }> {
    const indicator = await this.prisma.indicator.findUnique({
      where: { id: indicatorId },
      include: { source: true },
    });
    if (!indicator) throw new Error(`Indicator ${indicatorId} not found`);

    const observations = await this.prisma.observation.findMany({
      where: { indicatorId },
      orderBy: { date: 'asc' },
      take: 60,
    });
    if (observations.length === 0) {
      this.logger.warn(`No observations for ${indicator.slug}; skipping explainer.`);
      return { explainerId: null, sensitive: false, skipped: 'no-observations' };
    }
    const latest = observations[observations.length - 1];

    const existing = await this.prisma.indicatorExplainer.findFirst({
      where: { indicatorId, language: 'en', observationDate: latest.date },
      orderBy: { version: 'desc' },
    });
    if (existing) {
      return { explainerId: existing.id, sensitive: indicator.sensitiveFlag, skipped: 'up-to-date' };
    }

    const input: IndicatorExplainerInput = {
      indicatorSlug: indicator.slug,
      indicatorName: indicator.name,
      pillar: indicator.pillar,
      unitLabel: indicator.unitLabel,
      description: indicator.description ?? '',
      sourceName: indicator.source.name,
      observations: observations.map((o) => ({
        date: o.date.toISOString().slice(0, 10),
        value: Number(o.value),
      })),
    };

    const output = await this.ai.explainIndicator(input);

    const sensitive = output.sensitive || indicator.sensitiveFlag;
    const status: ExplainerStatus = sensitive
      ? ExplainerStatus.PENDING_REVIEW
      : ExplainerStatus.AUTO_APPROVED;

    // Bump indicator's sensitive_flag if the model surfaced it for the first time.
    if (output.sensitive && !indicator.sensitiveFlag) {
      await this.prisma.indicator.update({
        where: { id: indicatorId },
        data: { sensitiveFlag: true },
      });
    }

    const created = await this.prisma.indicatorExplainer.create({
      data: {
        indicatorId,
        observationDate: latest.date,
        version: 1,
        tldr: output.tldr,
        plainEnglish: output.plainEnglish,
        whatChanged: output.whatChanged,
        howItAffectsYou: output.howItAffectsYou,
        status,
        modelUsed: output.modelUsed,
        language: 'en',
      },
    });

    this.logger.log(
      `Generated indicator explainer for ${indicator.slug} @ ${latest.date.toISOString().slice(0, 10)} (sensitive=${sensitive})`,
    );
    return { explainerId: created.id, sensitive };
  }
}
