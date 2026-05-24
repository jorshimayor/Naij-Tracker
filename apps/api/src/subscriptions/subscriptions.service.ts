import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SubscriptionChannel, SubscriptionFrequency, SubscriptionTarget } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ALLOWED_TARGETS = new Set<SubscriptionTarget>([
  SubscriptionTarget.BILL,
  SubscriptionTarget.SPONSOR,
  SubscriptionTarget.TOPIC,
  SubscriptionTarget.CHAMBER,
]);

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const subs = await this.prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    // Resolve titles for each target so the UI doesn't have to lookup later.
    const billIds = subs.filter((s) => s.targetType === 'BILL').map((s) => s.targetId);
    const topicSlugs = subs.filter((s) => s.targetType === 'TOPIC').map((s) => s.targetId);
    const sponsorSlugs = subs.filter((s) => s.targetType === 'SPONSOR').map((s) => s.targetId);
    const chamberSlugs = subs.filter((s) => s.targetType === 'CHAMBER').map((s) => s.targetId);

    const [bills, topics, sponsors, chambers] = await Promise.all([
      billIds.length
        ? this.prisma.bill.findMany({
            where: { id: { in: billIds } },
            select: { id: true, billNumber: true, title: true, slug: true, jurisdiction: { select: { slug: true } } },
          })
        : Promise.resolve([]),
      topicSlugs.length
        ? this.prisma.topic.findMany({ where: { slug: { in: topicSlugs } }, select: { slug: true, name: true } })
        : Promise.resolve([]),
      sponsorSlugs.length
        ? this.prisma.legislator.findMany({ where: { slug: { in: sponsorSlugs } }, select: { slug: true, fullName: true } })
        : Promise.resolve([]),
      chamberSlugs.length
        ? this.prisma.jurisdiction.findMany({ where: { slug: { in: chamberSlugs } }, select: { slug: true, name: true } })
        : Promise.resolve([]),
    ]);
    const billsById = new Map(bills.map((b) => [b.id, b]));
    const topicsBySlug = new Map(topics.map((t) => [t.slug, t]));
    const sponsorsBySlug = new Map(sponsors.map((s) => [s.slug, s]));
    const chambersBySlug = new Map(chambers.map((c) => [c.slug, c]));

    return subs.map((s) => ({
      id: s.id,
      targetType: s.targetType,
      targetId: s.targetId,
      channel: s.channel,
      frequency: s.frequency,
      createdAt: s.createdAt,
      label: this.labelFor(s.targetType, s.targetId, { billsById, topicsBySlug, sponsorsBySlug, chambersBySlug }),
      href: this.hrefFor(s.targetType, s.targetId, { billsById }),
    }));
  }

  async create(userId: string, dto: {
    targetType: SubscriptionTarget;
    targetId: string;
    channel?: SubscriptionChannel;
    frequency?: SubscriptionFrequency;
  }) {
    if (!ALLOWED_TARGETS.has(dto.targetType)) {
      throw new BadRequestException(`Unsupported targetType: ${dto.targetType}`);
    }
    await this.validateTarget(dto.targetType, dto.targetId);

    const channel = dto.channel ?? SubscriptionChannel.EMAIL;
    const frequency = dto.frequency ?? SubscriptionFrequency.REALTIME;

    return this.prisma.subscription.upsert({
      where: {
        userId_targetType_targetId_channel: {
          userId,
          targetType: dto.targetType,
          targetId: dto.targetId,
          channel,
        },
      },
      create: {
        userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        channel,
        frequency,
      },
      update: { frequency },
    });
  }

  async remove(userId: string, id: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.userId !== userId) throw new NotFoundException('Subscription not found');
    await this.prisma.subscription.delete({ where: { id } });
    return { ok: true };
  }

  async hasSubscription(userId: string, targetType: SubscriptionTarget, targetId: string): Promise<boolean> {
    const count = await this.prisma.subscription.count({
      where: { userId, targetType, targetId },
    });
    return count > 0;
  }

  private async validateTarget(targetType: SubscriptionTarget, targetId: string) {
    switch (targetType) {
      case 'BILL': {
        const exists = await this.prisma.bill.count({ where: { id: targetId } });
        if (!exists) throw new NotFoundException('Bill not found');
        break;
      }
      case 'TOPIC': {
        const exists = await this.prisma.topic.count({ where: { slug: targetId } });
        if (!exists) throw new NotFoundException('Topic not found');
        break;
      }
      case 'SPONSOR': {
        const exists = await this.prisma.legislator.count({ where: { slug: targetId } });
        if (!exists) throw new NotFoundException('Legislator not found');
        break;
      }
      case 'CHAMBER': {
        const exists = await this.prisma.jurisdiction.count({ where: { slug: targetId } });
        if (!exists) throw new NotFoundException('Jurisdiction not found');
        break;
      }
    }
  }

  private labelFor(
    targetType: SubscriptionTarget,
    targetId: string,
    refs: {
      billsById: Map<string, any>;
      topicsBySlug: Map<string, any>;
      sponsorsBySlug: Map<string, any>;
      chambersBySlug: Map<string, any>;
    },
  ): string {
    if (targetType === 'BILL') {
      const b = refs.billsById.get(targetId);
      return b ? `${b.billNumber} — ${b.title}` : 'Unknown bill';
    }
    if (targetType === 'TOPIC') return refs.topicsBySlug.get(targetId)?.name ?? targetId;
    if (targetType === 'SPONSOR') return refs.sponsorsBySlug.get(targetId)?.fullName ?? targetId;
    if (targetType === 'CHAMBER') return refs.chambersBySlug.get(targetId)?.name ?? targetId;
    return targetId;
  }

  private hrefFor(
    targetType: SubscriptionTarget,
    targetId: string,
    refs: { billsById: Map<string, any> },
  ): string | null {
    if (targetType === 'BILL') {
      const b = refs.billsById.get(targetId);
      return b ? `/bills/${b.jurisdiction.slug}/${b.slug}` : null;
    }
    if (targetType === 'TOPIC') return `/topics/${targetId}`;
    if (targetType === 'SPONSOR') return `/legislators/${targetId}`;
    if (targetType === 'CHAMBER') return `/bills?jurisdiction=${targetId}`;
    return null;
  }
}
