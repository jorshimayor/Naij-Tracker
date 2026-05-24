import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface SendEmailInput {
  to: string;
  subject: string;
  /** Plain-text body. Always provided; HTML is optional but recommended for rich alerts. */
  text: string;
  html?: string;
  /** Internal category used for filtering the mock queue + analytics: "otp", "stage_change", etc. */
  category: string;
  /** Optional structured metadata persisted with the audit row. */
  metadata?: Record<string, unknown>;
}

export interface SendEmailResult {
  delivered: boolean;
  providerMessageId: string | null;
  error: string | null;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Best-effort send: always writes to the MockEmail audit table, then attempts delivery via the
   * configured provider. Returns the delivery result so callers can decide whether to retry.
   * Failures are logged but do not throw.
   */
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const audit = await this.prisma.mockEmail.create({
      data: {
        to: input.to,
        subject: input.subject,
        body: input.text,
        category: input.category,
        metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
      },
    });

    const provider = (process.env.EMAIL_PROVIDER ?? 'mock').toLowerCase();
    const dryRun = (process.env.EMAIL_DRY_RUN ?? 'false') === 'true';
    if (provider === 'mock' || dryRun) {
      this.logger.log(`[email:${provider}${dryRun ? ':dry' : ''}] to=${input.to} subject="${input.subject.slice(0, 80)}" id=${audit.id}`);
      return { delivered: false, providerMessageId: null, error: dryRun ? 'dry-run' : 'mock-provider' };
    }

    if (provider === 'resend') {
      return this.sendViaResend(input);
    }

    this.logger.warn(`Unknown EMAIL_PROVIDER "${provider}" — skipping send`);
    return { delivered: false, providerMessageId: null, error: `unknown-provider:${provider}` };
  }

  private async sendViaResend(input: SendEmailInput): Promise<SendEmailResult> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      this.logger.warn('Resend selected but RESEND_API_KEY is missing.');
      return { delivered: false, providerMessageId: null, error: 'missing-api-key' };
    }

    const from = process.env.EMAIL_FROM ?? 'Naija Bill Tracker <onboarding@resend.dev>';
    const replyTo = process.env.EMAIL_REPLY_TO || undefined;

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          text: input.text,
          html: input.html,
          ...(replyTo ? { reply_to: replyTo } : {}),
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(`Resend ${res.status} for ${input.to}: ${text.slice(0, 200)}`);
        return { delivered: false, providerMessageId: null, error: `resend:${res.status}` };
      }

      const data = (await res.json().catch(() => ({}))) as { id?: string };
      this.logger.log(`[email:resend] sent to=${input.to} id=${data.id ?? '?'} subject="${input.subject.slice(0, 80)}"`);
      return { delivered: true, providerMessageId: data.id ?? null, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Resend exception for ${input.to}: ${msg}`);
      return { delivered: false, providerMessageId: null, error: msg };
    }
  }
}
