import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BillStage, ExplainerStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AI_PROVIDER, type AIProvider } from '../ai/providers/ai-provider.interface';
import { TavilyService } from './tavily.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DigestService } from '../notifications/digest.service';
import { ExplainerService } from '../ai/explainer.service';
import { SubscriptionFrequency } from '@prisma/client';

const STAGE_ORDER: BillStage[] = [
  BillStage.INTRODUCED,
  BillStage.FIRST_READING,
  BillStage.SECOND_READING,
  BillStage.COMMITTEE,
  BillStage.THIRD_READING,
  BillStage.PASSED,
  BillStage.TRANSMITTED,
  BillStage.ASSENTED,
];

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
    private readonly tavily: TavilyService,
    private readonly notifications: NotificationsService,
    private readonly digest: DigestService,
    private readonly explainer: ExplainerService,
  ) {}

  runDigest(frequency: SubscriptionFrequency, dryRun: boolean) {
    return this.digest.runDigest(frequency, dryRun);
  }

  /**
   * Bills + their latest explainer, sorted so things that need a human come first:
   * 1. Pending review (sensitive bills the AI flagged)
   * 2. Flagged for inaccuracy
   * 3. Auto-approved (no human has looked yet)
   * 4. Human-approved
   */
  async getQueue(filter?: { status?: ExplainerStatus; jurisdiction?: string }) {
    const where: Prisma.BillWhereInput = {};
    if (filter?.jurisdiction) {
      where.jurisdiction = { slug: filter.jurisdiction };
    }
    if (filter?.status) {
      where.explainers = { some: { language: 'en', status: filter.status } };
    }

    const bills = await this.prisma.bill.findMany({
      where,
      orderBy: { lastActionDate: 'desc' },
      include: {
        jurisdiction: { select: { slug: true, name: true } },
        explainers: {
          where: { language: 'en' },
          orderBy: { version: 'desc' },
          take: 1,
        },
        sponsors: {
          take: 1,
          include: { legislator: { select: { fullName: true, party: true } } },
        },
      },
    });

    const statusRank: Record<ExplainerStatus, number> = {
      PENDING_REVIEW: 0,
      FLAGGED: 1,
      DRAFT: 2,
      AUTO_APPROVED: 3,
      APPROVED: 4,
    };
    const sorted = bills
      .map((b) => ({
        ...b,
        latest: b.explainers[0] ?? null,
      }))
      .sort((a, b) => {
        const ar = a.latest ? statusRank[a.latest.status] : 5;
        const br = b.latest ? statusRank[b.latest.status] : 5;
        if (ar !== br) return ar - br;
        return (b.lastActionDate?.getTime() ?? 0) - (a.lastActionDate?.getTime() ?? 0);
      });

    return sorted.map((b) => ({
      billId: b.id,
      billNumber: b.billNumber,
      title: b.title,
      slug: b.slug,
      jurisdiction: b.jurisdiction,
      currentStage: b.currentStage,
      sensitiveFlag: b.sensitiveFlag,
      lastActionDate: b.lastActionDate,
      sponsor: b.sponsors[0]?.legislator?.fullName ?? null,
      explainer: b.latest
        ? {
            id: b.latest.id,
            status: b.latest.status,
            verifiedAt: b.latest.verifiedAt,
            generatedAt: b.latest.generatedAt,
            modelUsed: b.latest.modelUsed,
            tldr: b.latest.tldr,
            reviewerNote: b.latest.reviewerNote,
          }
        : null,
    }));
  }

  async getBillForReview(billId: string) {
    const bill = await this.prisma.bill.findUnique({
      where: { id: billId },
      include: {
        jurisdiction: true,
        sponsors: { include: { legislator: true } },
        topics: { include: { topic: true } },
        stageEvents: { orderBy: { occurredOn: 'asc' } },
        documents: true,
        explainers: { where: { language: 'en' }, orderBy: { version: 'desc' } },
      },
    });
    if (!bill) throw new NotFoundException(`Bill ${billId} not found`);
    return bill;
  }

  async approve(explainerId: string, actor: string, note?: string) {
    const explainer = await this.prisma.aIExplainer.findUnique({ where: { id: explainerId } });
    if (!explainer) throw new NotFoundException(`Explainer ${explainerId} not found`);
    const before = { status: explainer.status, reviewerNote: explainer.reviewerNote };

    const updated = await this.prisma.aIExplainer.update({
      where: { id: explainerId },
      data: {
        status: ExplainerStatus.APPROVED,
        reviewedAt: new Date(),
        reviewerNote: note ?? null,
      },
    });
    await this.audit(actor, 'explainer.approve', 'AIExplainer', explainerId, before, {
      status: updated.status,
      reviewerNote: updated.reviewerNote,
    });
    return updated;
  }

  async flag(explainerId: string, actor: string, reason: string) {
    const explainer = await this.prisma.aIExplainer.findUnique({ where: { id: explainerId } });
    if (!explainer) throw new NotFoundException(`Explainer ${explainerId} not found`);
    const before = { status: explainer.status, reviewerNote: explainer.reviewerNote };

    const updated = await this.prisma.aIExplainer.update({
      where: { id: explainerId },
      data: {
        status: ExplainerStatus.FLAGGED,
        reviewedAt: new Date(),
        reviewerNote: reason,
      },
    });
    await this.audit(actor, 'explainer.flag', 'AIExplainer', explainerId, before, {
      status: updated.status,
      reviewerNote: updated.reviewerNote,
    });
    return updated;
  }

  /**
   * Editor-triggered stage advance. Validates the requested stage, records a BillStageEvent,
   * updates the bill's current stage, and fans out notifications to subscribers.
   * Used when scrapers haven't picked up a stage change yet (or, currently, when there are no
   * live scrapers and editors are moving bills manually).
   */
  async advanceStage(billId: string, actor: string, input: { newStage: BillStage; note?: string }) {
    const bill = await this.prisma.bill.findUnique({ where: { id: billId } });
    if (!bill) throw new NotFoundException('Bill not found');

    if (!(input.newStage in BillStage)) {
      throw new BadRequestException(`Unknown stage: ${input.newStage}`);
    }
    if (input.newStage === bill.currentStage) {
      throw new BadRequestException(`Bill is already at ${input.newStage}`);
    }

    const before = { currentStage: bill.currentStage };
    const now = new Date();
    const [updated] = await this.prisma.$transaction([
      this.prisma.bill.update({
        where: { id: billId },
        data: { currentStage: input.newStage, lastActionDate: now },
      }),
      this.prisma.billStageEvent.create({
        data: {
          billId,
          stage: input.newStage,
          occurredOn: now,
          notes: input.note ?? `Stage advanced by editor`,
        },
      }),
    ]);

    await this.audit(actor, 'bill.advance_stage', 'Bill', billId, before, {
      currentStage: updated.currentStage,
      note: input.note,
    });

    const notify = await this.notifications.notifyBillStageChange({
      billId,
      oldStage: bill.currentStage,
      newStage: input.newStage,
      note: input.note,
    });

    return {
      bill: { id: updated.id, currentStage: updated.currentStage, lastActionDate: updated.lastActionDate },
      notifications: notify,
    };
  }

  /** Suggest the next stage in the normal progression. Returns null if at end / non-linear state. */
  nextStage(current: BillStage): BillStage | null {
    const idx = STAGE_ORDER.indexOf(current);
    if (idx === -1 || idx === STAGE_ORDER.length - 1) return null;
    return STAGE_ORDER[idx + 1];
  }

  async setSensitive(billId: string, actor: string, sensitive: boolean) {
    const bill = await this.prisma.bill.findUnique({ where: { id: billId } });
    if (!bill) throw new NotFoundException(`Bill ${billId} not found`);
    const before = { sensitiveFlag: bill.sensitiveFlag };
    const updated = await this.prisma.bill.update({
      where: { id: billId },
      data: { sensitiveFlag: sensitive },
    });
    await this.audit(actor, 'bill.set_sensitive', 'Bill', billId, before, { sensitiveFlag: updated.sensitiveFlag });
    return updated;
  }

  /**
   * Translate an explainer into one of the Nigerian languages we support. Delegates to the
   * ExplainerService translation method (which is shared between admin-triggered and
   * automated paths). Audit-logged.
   */
  async translate(explainerId: string, actor: string, targetLanguage: string) {
    const source = await this.prisma.aIExplainer.findUnique({
      where: { id: explainerId },
      select: { id: true, billId: true, language: true },
    });
    if (!source) throw new NotFoundException(`Explainer ${explainerId} not found`);
    if (source.language !== 'en') {
      throw new BadRequestException('Translate from the English source explainer, not a translation.');
    }
    const result = await this.explainer.translateForBill(source.billId, targetLanguage);
    await this.audit(actor, 'explainer.translate', 'AIExplainer', source.id, null, {
      targetLanguage,
      translationId: result.explainerId,
      created: result.created,
    });
    return result;
  }

  async verify(explainerId: string, actor: string) {
    const explainer = await this.prisma.aIExplainer.findUnique({
      where: { id: explainerId },
      include: { bill: true },
    });
    if (!explainer) throw new NotFoundException(`Explainer ${explainerId} not found`);

    // Two passes in parallel: LLM-grounded check against bill text, and Tavily web search for
    // external sources an editor can cross-reference.
    const [llmResult, externalSources] = await Promise.all([
      this.ai.verifyExplainer({
        billNumber: explainer.bill.billNumber,
        title: explainer.bill.title,
        fullText: explainer.bill.fullText ?? '',
        tldr: explainer.tldr,
        plainEnglish: explainer.plainEnglish,
        howItAffectsYou: Array.isArray(explainer.howItAffectsYou)
          ? (explainer.howItAffectsYou as string[]).filter((x): x is string => typeof x === 'string')
          : [],
      }),
      this.tavily.search(
        this.tavily.buildQuery({ billNumber: explainer.bill.billNumber, title: explainer.bill.title }),
        5,
      ),
    ]);

    const merged = {
      ...llmResult,
      externalSources,
      externalSearchEnabled: this.tavily.isConfigured(),
    };

    const updated = await this.prisma.aIExplainer.update({
      where: { id: explainerId },
      data: {
        verification: merged as unknown as Prisma.InputJsonValue,
        verifiedAt: new Date(),
      },
    });
    await this.audit(actor, 'explainer.verify', 'AIExplainer', explainerId, null, {
      overallVerdict: llmResult.overallVerdict,
      checksCount: llmResult.checks.length,
      externalSourcesCount: externalSources.length,
      modelUsed: llmResult.modelUsed,
    });
    return { verification: merged, verifiedAt: updated.verifiedAt };
  }

  async getAuditLog(limit = 50) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** Dev helper: view the mock-email queue so editors can test the OTP / alert flows without SMTP. */
  async getMockEmails(limit = 50, category?: string) {
    return this.prisma.mockEmail.findMany({
      where: category ? { category } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private async audit(
    actor: string,
    action: string,
    entityType: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ) {
    await this.prisma.auditLog.create({
      data: {
        actorId: null, // v0 uses env-token auth, no DB user
        action,
        entityType,
        entityId,
        before: before as Prisma.InputJsonValue,
        after: after as Prisma.InputJsonValue,
      },
    });
    // (`actor` kept as a label for the log entry; in a future iteration we'd resolve to a user row.)
    void actor;
  }
}
