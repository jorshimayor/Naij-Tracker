import { Injectable, NotFoundException } from '@nestjs/common';
import { ExplainerStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { IndicatorObservationsQueryDto, ListIndicatorsQueryDto } from './dto';

function rangeStartFromNow(range: string | undefined): Date | null {
  if (!range || range === 'all') return null;
  const m = range.match(/^(\d+)([ymd])$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const d = new Date();
  if (unit === 'y') d.setFullYear(d.getFullYear() - n);
  else if (unit === 'm') d.setMonth(d.getMonth() - n);
  else if (unit === 'd') d.setDate(d.getDate() - n);
  return d;
}

@Injectable()
export class IndicatorsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListIndicatorsQueryDto) {
    const where: Prisma.IndicatorWhereInput = {};
    if (query.pillar) where.pillar = query.pillar;
    if (query.source) where.source = { slug: query.source };

    const indicators = await this.prisma.indicator.findMany({
      where,
      orderBy: [{ pillar: 'asc' }, { name: 'asc' }],
      include: {
        source: { select: { slug: true, name: true, acronym: true } },
        // Pull the last two observations so the list can render value + change inline.
        observations: { orderBy: { date: 'desc' }, take: 2 },
        explainers: {
          where: { language: 'en' },
          orderBy: [{ observationDate: 'desc' }, { version: 'desc' }],
          take: 1,
        },
      },
    });

    return {
      total: indicators.length,
      results: indicators.map((i) => this.serializeListItem(i)),
    };
  }

  async getBySlug(slug: string) {
    const indicator = await this.prisma.indicator.findUnique({
      where: { slug },
      include: {
        source: true,
        observations: { orderBy: { date: 'asc' }, take: 600 },
        explainers: {
          where: { language: 'en' },
          orderBy: [{ observationDate: 'desc' }, { version: 'desc' }],
          take: 1,
        },
        billLinks: {
          include: {
            bill: {
              include: {
                jurisdiction: { select: { slug: true, name: true } },
              },
            },
          },
          orderBy: { relevance: 'desc' },
          take: 10,
        },
      },
    });
    if (!indicator) throw new NotFoundException(`Indicator "${slug}" not found`);
    return this.serializeDetail(indicator);
  }

  async listObservations(slug: string, query: IndicatorObservationsQueryDto) {
    const indicator = await this.prisma.indicator.findUnique({ where: { slug } });
    if (!indicator) throw new NotFoundException(`Indicator "${slug}" not found`);
    const start = rangeStartFromNow(query.range ?? '5y');
    const observations = await this.prisma.observation.findMany({
      where: {
        indicatorId: indicator.id,
        ...(start ? { date: { gte: start } } : {}),
      },
      orderBy: { date: 'asc' },
      take: query.limit,
      include: {
        release: { select: { sample: true, releaseUrl: true } },
      },
    });
    return {
      slug,
      range: query.range ?? '5y',
      observations: observations.map((o) => ({
        date: o.date,
        value: Number(o.value),
        sample: o.release?.sample ?? false,
      })),
    };
  }

  private serializeListItem(i: any) {
    const latest = i.observations[0];
    const previous = i.observations[1];
    const change =
      latest && previous ? Number(latest.value) - Number(previous.value) : null;
    const explainer = i.explainers[0];
    return {
      slug: i.slug,
      name: i.name,
      pillar: i.pillar,
      subCategory: i.subCategory,
      unitLabel: i.unitLabel,
      frequency: i.frequency,
      sensitiveFlag: i.sensitiveFlag,
      description: i.description,
      source: i.source,
      latest: latest
        ? {
            date: latest.date,
            value: Number(latest.value),
            change,
          }
        : null,
      explainerTldr:
        explainer &&
        (explainer.status === ExplainerStatus.AUTO_APPROVED ||
          explainer.status === ExplainerStatus.APPROVED)
          ? explainer.tldr
          : null,
    };
  }

  private serializeDetail(i: any) {
    const explainer = i.explainers[0];
    const showExplainer =
      explainer &&
      (explainer.status === ExplainerStatus.AUTO_APPROVED ||
        explainer.status === ExplainerStatus.APPROVED);
    const observations = (i.observations as any[]).map((o) => ({
      date: o.date,
      value: Number(o.value),
    }));
    const latest = observations.length > 0 ? observations[observations.length - 1] : null;
    const previous =
      observations.length > 1 ? observations[observations.length - 2] : null;
    const yearAgo = observations.length >= 13 ? observations[observations.length - 13] : null;

    return {
      slug: i.slug,
      name: i.name,
      pillar: i.pillar,
      subCategory: i.subCategory,
      unit: i.unit,
      unitLabel: i.unitLabel,
      frequency: i.frequency,
      sensitiveFlag: i.sensitiveFlag,
      description: i.description,
      methodologyDoc: i.methodologyDoc,
      source: {
        slug: i.source.slug,
        name: i.source.name,
        acronym: i.source.acronym,
        homepageUrl: i.source.homepageUrl,
      },
      latest,
      changeVsPrevious: latest && previous ? latest.value - previous.value : null,
      changeVsYearAgo: latest && yearAgo ? latest.value - yearAgo.value : null,
      observations,
      explainer: explainer
        ? {
            status: explainer.status,
            visible: showExplainer,
            observationDate: explainer.observationDate,
            generatedAt: explainer.generatedAt,
            modelUsed: explainer.modelUsed,
            tldr: showExplainer ? explainer.tldr : null,
            plainEnglish: showExplainer ? explainer.plainEnglish : null,
            whatChanged: showExplainer ? explainer.whatChanged : null,
            howItAffectsYou: showExplainer ? explainer.howItAffectsYou : null,
          }
        : null,
      relatedBills: (i.billLinks as any[]).map((l) => ({
        billNumber: l.bill.billNumber,
        title: l.bill.title,
        slug: l.bill.slug,
        currentStage: l.bill.currentStage,
        jurisdiction: l.bill.jurisdiction,
        relevance: l.relevance,
        note: l.note,
      })),
    };
  }
}
