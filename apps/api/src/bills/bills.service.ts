import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ExplainerStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ListBillsQueryDto } from './dto';

const TITLE_STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'for', 'in', 'on', 'at', 'by', 'with',
  'bill', 'act', 'law', 'related', 'connected', 'matters', 'purposes',
  'amend', 'amendment', 'amending', 'establish', 'establishment', 'provide', 'provision',
  'other', 'further', 'is', 'are', 'be', 'as', 'shall', 'may',
]);

function titleTokens(title: string): Set<string> {
  return new Set(
    (title.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter((t) => !TITLE_STOPWORDS.has(t)),
  );
}

function intersectionCount<T>(a: Set<T>, b: Set<T>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

@Injectable()
export class BillsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListBillsQueryDto) {
    const where: Prisma.BillWhereInput = {};

    if (query.jurisdiction) {
      where.jurisdiction = { slug: query.jurisdiction };
    }
    if (query.stage) {
      where.currentStage = query.stage;
    }
    if (query.topic) {
      where.topics = { some: { topic: { slug: query.topic } } };
    }
    if (query.sponsor) {
      where.sponsors = { some: { legislator: { slug: query.sponsor } } };
    }

    // Full-text search via Postgres tsvector. We compute the vector at query time (no generated
    // column yet — that's a planned migration once the corpus grows). Bill numbers are matched
    // separately via ILIKE because they're not natural language.
    let rankedIds: string[] | null = null;
    if (query.q && query.q.trim().length > 0) {
      const q = query.q.trim();
      const matches = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM bills
        WHERE
          to_tsvector('english',
            coalesce(title, '') || ' ' ||
            coalesce(summary_short, '') || ' ' ||
            coalesce(full_text, '')
          ) @@ plainto_tsquery('english', ${q})
          OR bill_number ILIKE ${'%' + q + '%'}
        ORDER BY
          ts_rank(
            to_tsvector('english',
              coalesce(title, '') || ' ' ||
              coalesce(summary_short, '') || ' ' ||
              coalesce(full_text, '')
            ),
            plainto_tsquery('english', ${q})
          ) DESC,
          last_action_date DESC NULLS LAST
        LIMIT 500
      `;
      rankedIds = matches.map((r) => r.id);
      if (rankedIds.length === 0) {
        return { total: 0, limit: query.limit, offset: query.offset, results: [] };
      }
      where.id = { in: rankedIds };
    }

    const useRelevance = !!rankedIds && (!query.sort || query.sort === 'relevance');
    const orderBy: Prisma.BillOrderByWithRelationInput | undefined = useRelevance
      ? undefined
      : query.sort === 'introduced_desc'
        ? { introducedDate: 'desc' }
        : { lastActionDate: 'desc' };

    const [total, billsRaw] = await this.prisma.$transaction([
      this.prisma.bill.count({ where }),
      this.prisma.bill.findMany({
        where,
        ...(orderBy ? { orderBy } : {}),
        take: useRelevance ? undefined : query.limit,
        skip: useRelevance ? undefined : query.offset,
        include: {
          jurisdiction: { select: { slug: true, name: true, type: true } },
          sponsors: {
            include: {
              legislator: { select: { slug: true, fullName: true, party: true } },
            },
          },
          topics: { include: { topic: { select: { slug: true, name: true } } } },
          _count: { select: { comments: true, stageEvents: true } },
        },
      }),
    ]);

    // Re-order by FTS rank if we have one, then apply pagination in memory (the candidate set is
    // capped at 500 — safe and predictable).
    let bills = billsRaw;
    if (useRelevance && rankedIds) {
      const position = new Map(rankedIds.map((id, i) => [id, i]));
      bills = [...billsRaw].sort((a, b) => (position.get(a.id) ?? 1e9) - (position.get(b.id) ?? 1e9));
      bills = bills.slice(query.offset, query.offset + query.limit);
    }

    return {
      total,
      limit: query.limit,
      offset: query.offset,
      results: bills.map((b) => this.serializeListItem(b)),
    };
  }

  /**
   * Export bills matching the same filters as `list()` to CSV. No pagination — exports the whole
   * matching set, capped at 5000 rows for safety.
   */
  async exportCsv(query: ListBillsQueryDto): Promise<string> {
    const flat = await this.list({ ...query, limit: 5000, offset: 0 } as ListBillsQueryDto);
    const header = [
      'bill_number', 'title', 'jurisdiction', 'current_stage',
      'introduced_date', 'last_action_date', 'sensitive',
      'primary_sponsor', 'sponsor_party', 'topics', 'url',
    ];
    const rows = flat.results.map((b: any) => [
      b.billNumber,
      b.title,
      b.jurisdiction.name,
      b.currentStage,
      b.introducedDate ? new Date(b.introducedDate).toISOString().slice(0, 10) : '',
      b.lastActionDate ? new Date(b.lastActionDate).toISOString().slice(0, 10) : '',
      b.sensitiveFlag ? 'true' : 'false',
      b.primarySponsor?.fullName ?? '',
      b.primarySponsor?.party ?? '',
      b.topics.map((t: any) => t.slug).join('|'),
      `/bills/${b.jurisdiction.slug}/${b.slug}`,
    ]);
    return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
  }

  async getByJurisdictionAndSlug(jurisdictionSlug: string, slug: string, language: string = 'en') {
    const jurisdiction = await this.prisma.jurisdiction.findUnique({
      where: { slug: jurisdictionSlug },
    });
    if (!jurisdiction) throw new NotFoundException(`Jurisdiction "${jurisdictionSlug}" not found`);

    const bill = await this.prisma.bill.findUnique({
      where: { jurisdictionId_slug: { jurisdictionId: jurisdiction.id, slug } },
      include: {
        jurisdiction: true,
        sponsors: {
          include: {
            legislator: {
              select: { slug: true, fullName: true, party: true, chamber: true, photoUrl: true, state: true, constituency: true },
            },
          },
        },
        topics: { include: { topic: true } },
        stageEvents: { orderBy: { occurredOn: 'asc' } },
        documents: { orderBy: { retrievedAt: 'desc' } },
        // Pull every language version so we know which translations exist.
        explainers: { orderBy: [{ version: 'desc' }, { language: 'asc' }] },
        indicatorLinks: {
          include: {
            indicator: {
              select: { slug: true, name: true, pillar: true, unitLabel: true },
            },
          },
          orderBy: { relevance: 'desc' },
          take: 8,
        },
      },
    });
    if (!bill) throw new NotFoundException(`Bill "${slug}" not found in ${jurisdictionSlug}`);

    return this.serializeDetail(bill, language);
  }

  /**
   * Cross-chamber duplicate detection. Heuristic: bills in a *different* jurisdiction whose
   * normalized title shares >= 40% of the non-stopword tokens with this bill. We also boost
   * matches that share at least one topic.
   *
   * Not pretending to be perfect — it's a starting point to surface "this is the Senate version
   * of an existing Reps bill" cases. Real production would use embeddings (pgvector).
   */
  async findCrossChamberDuplicates(billId: string, limit = 4) {
    const bill = await this.prisma.bill.findUnique({
      where: { id: billId },
      include: {
        jurisdiction: { select: { id: true } },
        topics: { select: { topicId: true } },
      },
    });
    if (!bill) return [];

    const myTokens = titleTokens(bill.title);
    if (myTokens.size === 0) return [];

    // Pull candidates: other jurisdictions only, optionally narrowed by shared topic.
    const myTopicIds = bill.topics.map((t) => t.topicId);
    const candidates = await this.prisma.bill.findMany({
      where: {
        id: { not: bill.id },
        jurisdictionId: { not: bill.jurisdiction.id },
        ...(myTopicIds.length > 0
          ? { topics: { some: { topicId: { in: myTopicIds } } } }
          : {}),
      },
      take: 50,
      orderBy: { lastActionDate: 'desc' },
      include: {
        jurisdiction: { select: { slug: true, name: true } },
        topics: { include: { topic: { select: { slug: true } } } },
      },
    });

    const scored = candidates
      .map((c) => {
        const theirTokens = titleTokens(c.title);
        const overlap = intersectionCount(myTokens, theirTokens);
        const denom = Math.max(myTokens.size, theirTokens.size);
        const jaccardish = denom > 0 ? overlap / denom : 0;
        const sharedTopics = c.topics.filter((t) => myTopicIds.includes(t.topicId)).length;
        const score = jaccardish + sharedTopics * 0.08;
        return { c, score, overlap, jaccardish };
      })
      .filter((x) => x.jaccardish >= 0.4 || (x.overlap >= 4 && x.jaccardish >= 0.3))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map(({ c, jaccardish }) => ({
      id: c.id,
      billNumber: c.billNumber,
      title: c.title,
      slug: c.slug,
      jurisdiction: c.jurisdiction,
      currentStage: c.currentStage,
      similarityPercent: Math.round(jaccardish * 100),
    }));
  }

  async findRelated(jurisdictionSlug: string, slug: string, limit = 4) {
    const jurisdiction = await this.prisma.jurisdiction.findUnique({
      where: { slug: jurisdictionSlug },
    });
    if (!jurisdiction) return [];
    const bill = await this.prisma.bill.findUnique({
      where: { jurisdictionId_slug: { jurisdictionId: jurisdiction.id, slug } },
      include: { topics: { select: { topicId: true } } },
    });
    if (!bill) return [];
    const topicIds = bill.topics.map((t) => t.topicId);
    if (topicIds.length === 0) return [];

    const related = await this.prisma.bill.findMany({
      where: {
        id: { not: bill.id },
        topics: { some: { topicId: { in: topicIds } } },
      },
      orderBy: { lastActionDate: 'desc' },
      take: limit,
      include: {
        jurisdiction: { select: { slug: true, name: true } },
        topics: { include: { topic: { select: { slug: true, name: true } } } },
      },
    });
    return related.map((b) => ({
      billNumber: b.billNumber,
      title: b.title,
      slug: b.slug,
      jurisdiction: b.jurisdiction,
      currentStage: b.currentStage,
      topics: b.topics.map((t) => t.topic),
    }));
  }

  private serializeListItem(b: any) {
    const primarySponsor = b.sponsors.find((s: any) => s.role === 'PRIMARY')?.legislator ?? b.sponsors[0]?.legislator;
    return {
      id: b.id,
      billNumber: b.billNumber,
      title: b.title,
      slug: b.slug,
      summaryShort: b.summaryShort,
      currentStage: b.currentStage,
      introducedDate: b.introducedDate,
      lastActionDate: b.lastActionDate,
      sensitiveFlag: b.sensitiveFlag,
      jurisdiction: b.jurisdiction,
      primarySponsor,
      sponsorCount: b.sponsors.length,
      topics: b.topics.map((t: any) => t.topic),
      counts: { comments: b._count.comments, stageEvents: b._count.stageEvents },
    };
  }

  private serializeDetail(b: any, requestedLanguage: string = 'en') {
    // Latest version overall, then pick the requested language or fall back to English.
    const allExplainers = (b.explainers ?? []) as any[];
    const latestVersion = allExplainers.reduce<number>((m, e) => Math.max(m, e.version ?? 0), 0);
    const versionMatched = allExplainers.filter((e) => e.version === latestVersion);
    const explainer =
      versionMatched.find((e) => e.language === requestedLanguage) ??
      versionMatched.find((e) => e.language === 'en') ??
      null;
    const availableLanguages: string[] = Array.from(
      new Set(versionMatched.map((e) => e.language as string)),
    ).sort();
    const requestedAvailable = availableLanguages.includes(requestedLanguage);
    const showExplainer =
      explainer && (explainer.status === ExplainerStatus.AUTO_APPROVED || explainer.status === ExplainerStatus.APPROVED);
    return {
      id: b.id,
      billNumber: b.billNumber,
      title: b.title,
      slug: b.slug,
      summaryShort: b.summaryShort,
      summaryLong: b.summaryLong,
      fullText: b.fullText,
      currentStage: b.currentStage,
      introducedDate: b.introducedDate,
      lastActionDate: b.lastActionDate,
      sensitiveFlag: b.sensitiveFlag,
      jurisdiction: {
        slug: b.jurisdiction.slug,
        name: b.jurisdiction.name,
        type: b.jurisdiction.type,
        stateCode: b.jurisdiction.stateCode,
        websiteUrl: b.jurisdiction.websiteUrl,
      },
      sponsors: b.sponsors.map((s: any) => ({
        role: s.role,
        legislator: s.legislator,
      })),
      topics: b.topics.map((t: any) => ({
        slug: t.topic.slug,
        name: t.topic.name,
        source: t.source,
        confidence: t.confidence,
      })),
      stageEvents: b.stageEvents.map((e: any) => ({
        stage: e.stage,
        occurredOn: e.occurredOn,
        notes: e.notes,
      })),
      documents: b.documents.map((d: any) => ({
        type: d.type,
        url: d.url,
        description: d.description,
        retrievedAt: d.retrievedAt,
      })),
      indicators: (b.indicatorLinks ?? []).map((l: any) => ({
        slug: l.indicator.slug,
        name: l.indicator.name,
        pillar: l.indicator.pillar,
        unitLabel: l.indicator.unitLabel,
        relevance: l.relevance,
        note: l.note,
      })),
      explainer: explainer
        ? {
            status: explainer.status,
            visible: showExplainer,
            version: explainer.version,
            language: explainer.language,
            requestedLanguage,
            requestedAvailable,
            availableLanguages,
            generatedAt: explainer.generatedAt,
            modelUsed: explainer.modelUsed,
            tldr: showExplainer ? explainer.tldr : null,
            plainEnglish: showExplainer ? explainer.plainEnglish : null,
            howItAffectsYou: showExplainer ? explainer.howItAffectsYou : null,
            argumentsFor: showExplainer ? explainer.argumentsFor : null,
            argumentsAgainst: showExplainer ? explainer.argumentsAgainst : null,
            jargonTerms: showExplainer ? explainer.jargonTerms : null,
            sourceCitations: showExplainer ? explainer.sourceCitations : null,
          }
        : null,
    };
  }
}
