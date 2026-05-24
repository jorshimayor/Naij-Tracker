import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BillStage, Prisma, SubscriptionFrequency, SubscriptionTarget } from '@prisma/client';
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

export interface DigestRunSummary {
  frequency: SubscriptionFrequency;
  usersScanned: number;
  usersEmailed: number;
  emailsDelivered: number;
  emailsFailed: number;
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
}

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  // 07:00 daily in Africa/Lagos (UTC+1, no DST).
  @Cron('0 7 * * *', { timeZone: 'Africa/Lagos' })
  async runDailyCron(): Promise<void> {
    if (process.env.DIGEST_DISABLED === 'true') return;
    const summary = await this.runDigest(SubscriptionFrequency.DAILY, false);
    this.logger.log(`daily digest: ${JSON.stringify(summary)}`);
  }

  // 07:00 Monday in Africa/Lagos.
  @Cron('0 7 * * 1', { timeZone: 'Africa/Lagos' })
  async runWeeklyCron(): Promise<void> {
    if (process.env.DIGEST_DISABLED === 'true') return;
    const summary = await this.runDigest(SubscriptionFrequency.WEEKLY, false);
    this.logger.log(`weekly digest: ${JSON.stringify(summary)}`);
  }

  /**
   * Run one digest pass: find every user with at least one subscription at this frequency,
   * gather their unsent stage events, send a single batched email, update lastXDigestAt.
   *
   * `dryRun` skips the email send and the lastXDigestAt update — useful for previewing.
   */
  async runDigest(frequency: SubscriptionFrequency, dryRun: boolean): Promise<DigestRunSummary> {
    const startedAt = new Date();
    const lookbackFallbackMs = frequency === SubscriptionFrequency.DAILY ? 26 * 3600_000 : 7 * 24 * 3600_000 + 3600_000;

    const summary: DigestRunSummary = {
      frequency,
      usersScanned: 0,
      usersEmailed: 0,
      emailsDelivered: 0,
      emailsFailed: 0,
      startedAt: startedAt.toISOString(),
      finishedAt: '',
      dryRun,
    };

    // Reference data — pulled once per run.
    const [allTopics, allLegislators, allJurisdictions] = await Promise.all([
      this.prisma.topic.findMany({ select: { id: true, slug: true } }),
      this.prisma.legislator.findMany({ select: { id: true, slug: true } }),
      this.prisma.jurisdiction.findMany({ select: { id: true, slug: true } }),
    ]);
    const topicIdBySlug = new Map(allTopics.map((t) => [t.slug, t.id]));
    const legislatorIdBySlug = new Map(allLegislators.map((l) => [l.slug, l.id]));
    const jurisdictionIdBySlug = new Map(allJurisdictions.map((j) => [j.slug, j.id]));

    // Find candidate users — those with at least one matching-frequency subscription.
    const candidates = await this.prisma.user.findMany({
      where: {
        emailVerified: true,
        subscriptions: { some: { frequency } },
      },
      include: {
        subscriptions: { where: { frequency } },
      },
    });

    const webBase = (process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');

    for (const user of candidates) {
      summary.usersScanned++;
      const sinceCol = frequency === SubscriptionFrequency.DAILY ? user.lastDailyDigestAt : user.lastWeeklyDigestAt;
      const since = sinceCol ?? new Date(startedAt.getTime() - lookbackFallbackMs);

      // Build the bill-match filter based on this user's subs.
      const billIds: string[] = [];
      const topicIds: string[] = [];
      const legislatorIds: string[] = [];
      const jurisdictionIds: string[] = [];
      for (const sub of user.subscriptions) {
        switch (sub.targetType) {
          case SubscriptionTarget.BILL:    billIds.push(sub.targetId); break;
          case SubscriptionTarget.TOPIC: {
            const id = topicIdBySlug.get(sub.targetId);
            if (id) topicIds.push(id);
            break;
          }
          case SubscriptionTarget.SPONSOR: {
            const id = legislatorIdBySlug.get(sub.targetId);
            if (id) legislatorIds.push(id);
            break;
          }
          case SubscriptionTarget.CHAMBER: {
            const id = jurisdictionIdBySlug.get(sub.targetId);
            if (id) jurisdictionIds.push(id);
            break;
          }
        }
      }

      const billOr: Prisma.BillWhereInput[] = [];
      if (billIds.length) billOr.push({ id: { in: billIds } });
      if (topicIds.length) billOr.push({ topics: { some: { topicId: { in: topicIds } } } });
      if (legislatorIds.length) billOr.push({ sponsors: { some: { legislatorId: { in: legislatorIds } } } });
      if (jurisdictionIds.length) billOr.push({ jurisdictionId: { in: jurisdictionIds } });
      if (billOr.length === 0) continue;

      const events = await this.prisma.billStageEvent.findMany({
        where: {
          createdAt: { gt: since },
          bill: { OR: billOr },
        },
        orderBy: { occurredOn: 'desc' },
        take: 100,
        include: {
          bill: {
            include: {
              jurisdiction: { select: { slug: true, name: true } },
            },
          },
        },
      });

      if (events.length === 0) continue;

      const dedupedByBill = dedupeLatestPerBill(events);
      const subject = buildDigestSubject(frequency, dedupedByBill.length);
      const { text, html } = buildDigestEmail({
        frequency,
        events: dedupedByBill,
        webBase,
      });

      if (dryRun) {
        summary.usersEmailed++;
        this.logger.log(`[dry-run] would email ${user.email} with ${dedupedByBill.length} bill update(s)`);
        continue;
      }

      const result = await this.email.send({
        to: user.email,
        subject,
        text,
        html,
        category: 'digest',
        metadata: {
          frequency,
          billCount: dedupedByBill.length,
          since: since.toISOString(),
        },
      });
      summary.usersEmailed++;
      if (result.delivered) summary.emailsDelivered++;
      else summary.emailsFailed++;

      await this.prisma.user.update({
        where: { id: user.id },
        data: frequency === SubscriptionFrequency.DAILY
          ? { lastDailyDigestAt: startedAt }
          : { lastWeeklyDigestAt: startedAt },
      });
    }

    summary.finishedAt = new Date().toISOString();
    return summary;
  }
}

interface EventRow {
  stage: BillStage;
  occurredOn: Date;
  notes: string | null;
  bill: {
    id: string;
    billNumber: string;
    title: string;
    slug: string;
    jurisdiction: { slug: string; name: string };
  };
}

function dedupeLatestPerBill(events: EventRow[]): EventRow[] {
  const seen = new Set<string>();
  const out: EventRow[] = [];
  for (const e of events) {
    if (seen.has(e.bill.id)) continue;
    seen.add(e.bill.id);
    out.push(e);
  }
  return out;
}

function buildDigestSubject(frequency: SubscriptionFrequency, count: number): string {
  const label = frequency === SubscriptionFrequency.DAILY ? 'daily' : 'weekly';
  return `Your ${label} bill digest — ${count} update${count === 1 ? '' : 's'}`;
}

function buildDigestEmail(opts: {
  frequency: SubscriptionFrequency;
  events: EventRow[];
  webBase: string;
}): { text: string; html: string } {
  const heading = opts.frequency === SubscriptionFrequency.DAILY
    ? 'Your daily digest'
    : 'Your weekly digest';

  const textLines: string[] = [
    heading,
    '',
    `${opts.events.length} bill${opts.events.length === 1 ? '' : 's'} you follow moved recently:`,
    '',
  ];
  const htmlItems: string[] = [];

  for (const e of opts.events) {
    const url = `${opts.webBase}/bills/${e.bill.jurisdiction.slug}/${e.bill.slug}`;
    const label = STAGE_LABELS[e.stage] ?? e.stage;
    textLines.push(`• ${e.bill.billNumber} (${e.bill.jurisdiction.name}) — now at ${label}`);
    textLines.push(`  ${e.bill.title}`);
    if (e.notes) textLines.push(`  Note: ${e.notes}`);
    textLines.push(`  ${url}`);
    textLines.push('');

    htmlItems.push(`
      <li style="margin:0 0 18px 0;padding-bottom:18px;border-bottom:1px solid #e2e8f0;">
        <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">
          ${escapeHtml(e.bill.jurisdiction.name)} · ${escapeHtml(e.bill.billNumber)} · ${escapeHtml(label)}
        </div>
        <a href="${url}" style="display:block;margin-top:4px;font-family:Georgia,serif;font-size:16px;color:#0f172a;text-decoration:none;line-height:1.3;">
          ${escapeHtml(e.bill.title)}
        </a>
        ${e.notes ? `<p style="margin:6px 0 0 0;font-size:14px;color:#475569;border-left:3px solid #e2e8f0;padding-left:10px;">${escapeHtml(e.notes)}</p>` : ''}
      </li>
    `);
  }

  const manageUrl = `${opts.webBase}/me/following`;
  const text = [
    ...textLines,
    `Manage your subscriptions: ${manageUrl}`,
  ].join('\n');

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;line-height:1.5;">
        <tr><td>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
            <span style="display:inline-block;width:6px;height:18px;border-radius:3px;background:#008751;"></span>
            <span style="font-family:Georgia,serif;font-size:18px;font-weight:600;">Naija Bill Tracker</span>
          </div>
          <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:600;margin:0 0 12px 0;">${escapeHtml(heading)}</h1>
          <p style="margin:0 0 18px 0;">${opts.events.length} bill${opts.events.length === 1 ? '' : 's'} you follow moved recently.</p>
          <ul style="list-style:none;padding:0;margin:0;">${htmlItems.join('')}</ul>
          <div style="border-top:1px solid #e2e8f0;margin-top:20px;padding-top:14px;font-size:12px;color:#64748b;">
            <a style="color:#64748b;" href="${manageUrl}">Manage your subscriptions</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { text, html };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
