import { Injectable, Logger } from '@nestjs/common';
import { BillStage, SubscriptionFrequency } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { stageChangeEmailHtml } from '../email/templates';

const STAGE_LABELS: Record<BillStage, string> = {
  INTRODUCED: 'Introduced',
  FIRST_READING: 'First reading',
  SECOND_READING: 'Second reading',
  COMMITTEE: 'Committee',
  THIRD_READING: 'Third reading',
  PASSED: 'Passed',
  TRANSMITTED: 'Transmitted',
  ASSENTED: 'Assented',
  WITHDRAWN: 'Withdrawn',
  LAPSED: 'Lapsed',
};

interface NotifyStageChangeInput {
  billId: string;
  oldStage: BillStage;
  newStage: BillStage;
  note?: string;
}

export interface NotifySummary {
  recipients: number;
  delivered: number;
  failed: number;
  skipped: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async notifyBillStageChange(input: NotifyStageChangeInput): Promise<NotifySummary> {
    const bill = await this.prisma.bill.findUnique({
      where: { id: input.billId },
      include: {
        jurisdiction: { select: { slug: true, name: true } },
        topics: { select: { topicId: true, topic: { select: { slug: true, name: true } } } },
        sponsors: { select: { legislatorId: true, legislator: { select: { slug: true, fullName: true } } } },
      },
    });
    if (!bill) {
      this.logger.warn(`notifyBillStageChange called for unknown bill ${input.billId}`);
      return { recipients: 0, delivered: 0, failed: 0, skipped: 0 };
    }

    // Pull matching subscriptions in one query each, then merge in memory.
    const topicSlugs = bill.topics.map((t) => t.topic.slug);
    const sponsorSlugs = bill.sponsors.map((s) => s.legislator.slug);
    const chamberSlug = bill.jurisdiction.slug;

    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        frequency: SubscriptionFrequency.REALTIME,
        OR: [
          { targetType: 'BILL',    targetId: input.billId },
          { targetType: 'TOPIC',   targetId: { in: topicSlugs } },
          { targetType: 'SPONSOR', targetId: { in: sponsorSlugs } },
          { targetType: 'CHAMBER', targetId: chamberSlug },
        ],
      },
      include: { user: { select: { email: true, displayName: true, emailVerified: true } } },
    });

    // Group by recipient and collect all reasons so we can phrase a single email per person.
    const byEmail = new Map<string, { reasons: string[]; verified: boolean }>();
    const topicNameBySlug = new Map(bill.topics.map((t) => [t.topic.slug, t.topic.name]));
    const sponsorNameBySlug = new Map(bill.sponsors.map((s) => [s.legislator.slug, s.legislator.fullName]));

    for (const sub of subscriptions) {
      const reason = describeReason(sub.targetType, sub.targetId, {
        billNumber: bill.billNumber,
        chamberName: bill.jurisdiction.name,
        topicName: topicNameBySlug.get(sub.targetId),
        sponsorName: sponsorNameBySlug.get(sub.targetId),
      });
      const entry = byEmail.get(sub.user.email) ?? { reasons: [], verified: sub.user.emailVerified };
      entry.reasons.push(reason);
      byEmail.set(sub.user.email, entry);
    }

    if (byEmail.size === 0) {
      this.logger.log(`stage_change ${bill.billNumber}: no subscribers`);
      return { recipients: 0, delivered: 0, failed: 0, skipped: 0 };
    }

    const webBase = (process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    const billUrl = `${webBase}/bills/${bill.jurisdiction.slug}/${bill.slug}`;
    const manageUrl = `${webBase}/me/following`;
    const oldLabel = STAGE_LABELS[input.oldStage] ?? input.oldStage;
    const newLabel = STAGE_LABELS[input.newStage] ?? input.newStage;
    const subject = `${bill.billNumber}: now at ${newLabel}`;

    let delivered = 0, failed = 0, skipped = 0;
    for (const [email, { reasons, verified }] of byEmail.entries()) {
      if (!verified) { skipped++; continue; }
      const why = humaniseReasons(reasons);
      const text =
        `${bill.title}\n\n` +
        `${bill.jurisdiction.name} · ${bill.billNumber}\n\n` +
        `This bill moved from ${oldLabel} to ${newLabel}.\n` +
        (input.note ? `\nNote: ${input.note}\n` : '') +
        `\nRead the latest: ${billUrl}\n\n` +
        `You received this because ${why}. Manage your subscriptions: ${manageUrl}`;
      const html = stageChangeEmailHtml({
        billNumber: bill.billNumber,
        billTitle: bill.title,
        jurisdictionName: bill.jurisdiction.name,
        oldStage: oldLabel,
        newStage: newLabel,
        why,
        billUrl,
        manageUrl,
        notes: input.note,
      });

      const result = await this.email.send({
        to: email,
        subject,
        text,
        html,
        category: 'stage_change',
        metadata: {
          billId: bill.id,
          billNumber: bill.billNumber,
          oldStage: input.oldStage,
          newStage: input.newStage,
        },
      });
      if (result.delivered) delivered++;
      else failed++;
    }

    this.logger.log(
      `stage_change ${bill.billNumber}: recipients=${byEmail.size} delivered=${delivered} failed=${failed} skipped=${skipped}`,
    );
    return { recipients: byEmail.size, delivered, failed, skipped };
  }
}

function describeReason(
  targetType: string,
  targetId: string,
  ctx: { billNumber: string; chamberName: string; topicName?: string; sponsorName?: string },
): string {
  switch (targetType) {
    case 'BILL':    return `you follow ${ctx.billNumber}`;
    case 'TOPIC':   return `you follow the topic "${ctx.topicName ?? targetId}"`;
    case 'SPONSOR': return `you follow ${ctx.sponsorName ?? targetId}`;
    case 'CHAMBER': return `you follow bills in the ${ctx.chamberName}`;
    default:        return `you subscribed`;
  }
}

function humaniseReasons(reasons: string[]): string {
  const unique = Array.from(new Set(reasons));
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(', ')}, and ${unique.at(-1)}`;
}
