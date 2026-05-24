import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ContributionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExplainerService } from '../ai/explainer.service';
import { TaggerService } from '../ai/tagger.service';

function slugify(input: string, fallback: string): string {
  const slug = input
    .toLowerCase()
    .replace(/^a bill for an act to\s*/i, '')
    .replace(/^a bill for a law to\s*/i, '')
    .replace(/,?\s*and for (related|connected) (matters|purposes)\.?$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || fallback.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

interface SubmitInput {
  jurisdictionSlug: string;
  billNumber: string;
  title: string;
  summary?: string;
  sourceUrl?: string;
  fullText?: string;
  submitterNote?: string;
}

@Injectable()
export class ContributionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly explainer: ExplainerService,
    private readonly tagger: TaggerService,
  ) {}

  async submit(submitterId: string, input: SubmitInput) {
    const jurisdiction = await this.prisma.jurisdiction.findUnique({
      where: { slug: input.jurisdictionSlug },
    });
    if (!jurisdiction) throw new BadRequestException(`Unknown jurisdiction: ${input.jurisdictionSlug}`);

    // Don't accept obvious duplicates.
    const existingTracked = await this.prisma.bill.findFirst({
      where: { jurisdictionId: jurisdiction.id, billNumber: input.billNumber.trim() },
      select: { id: true, slug: true, jurisdiction: { select: { slug: true } } },
    });
    if (existingTracked) {
      throw new BadRequestException(
        `This bill is already tracked: /bills/${existingTracked.jurisdiction.slug}/${existingTracked.slug}`,
      );
    }

    return this.prisma.contributedBill.create({
      data: {
        submitterId,
        jurisdictionId: jurisdiction.id,
        billNumber: input.billNumber.trim(),
        title: input.title.trim(),
        summary: input.summary?.trim() || null,
        sourceUrl: input.sourceUrl?.trim() || null,
        fullText: input.fullText?.trim() || null,
        submitterNote: input.submitterNote?.trim() || null,
        status: ContributionStatus.PENDING,
      },
    });
  }

  async listMine(submitterId: string) {
    return this.prisma.contributedBill.findMany({
      where: { submitterId },
      orderBy: { createdAt: 'desc' },
      include: { jurisdiction: { select: { slug: true, name: true } } },
    });
  }

  async listForReview(status?: ContributionStatus) {
    return this.prisma.contributedBill.findMany({
      where: status ? { status } : {},
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' },
      ],
      include: {
        jurisdiction: { select: { slug: true, name: true } },
        submitter: { select: { email: true, displayName: true } },
      },
    });
  }

  async getDetail(id: string) {
    const contribution = await this.prisma.contributedBill.findUnique({
      where: { id },
      include: {
        jurisdiction: true,
        submitter: { select: { id: true, email: true, displayName: true, createdAt: true } },
        publishedBill: { select: { slug: true, jurisdiction: { select: { slug: true } } } },
      },
    });
    if (!contribution) throw new NotFoundException('Contribution not found');
    return contribution;
  }

  async reject(id: string, reviewerNote: string) {
    const contribution = await this.prisma.contributedBill.findUnique({ where: { id } });
    if (!contribution) throw new NotFoundException('Contribution not found');
    return this.prisma.contributedBill.update({
      where: { id },
      data: {
        status: ContributionStatus.REJECTED,
        reviewerNote,
        reviewedAt: new Date(),
      },
    });
  }

  /**
   * Approve and publish: creates a real Bill record, runs the AI explainer + tagger,
   * and links the contribution. The contribution becomes immutable after this.
   */
  async approveAndPublish(id: string, reviewerNote?: string) {
    const contribution = await this.prisma.contributedBill.findUnique({ where: { id } });
    if (!contribution) throw new NotFoundException('Contribution not found');
    if (contribution.status === ContributionStatus.PUBLISHED) {
      throw new BadRequestException('Already published');
    }

    // Double-check no race introduced an identical bill since submission.
    const existing = await this.prisma.bill.findUnique({
      where: {
        jurisdictionId_billNumber: {
          jurisdictionId: contribution.jurisdictionId,
          billNumber: contribution.billNumber,
        },
      },
    });
    if (existing) {
      throw new BadRequestException('A bill with that number already exists in this jurisdiction.');
    }

    const slug = slugify(contribution.title, contribution.billNumber);
    const fullText = contribution.fullText || contribution.summary || contribution.title;

    const bill = await this.prisma.bill.create({
      data: {
        jurisdictionId: contribution.jurisdictionId,
        billNumber: contribution.billNumber,
        title: contribution.title,
        slug,
        currentStage: 'INTRODUCED',
        introducedDate: new Date(),
        lastActionDate: new Date(),
        summaryShort: contribution.summary,
        fullText,
      },
    });

    if (contribution.sourceUrl) {
      await this.prisma.sourceDocument.create({
        data: {
          billId: bill.id,
          type: 'HTML',
          url: contribution.sourceUrl,
          description: 'Submitted by a community contributor',
        },
      });
    }

    // Run AI pipeline (same as scraper path)
    await this.explainer.generateForBill(bill.id).catch(() => undefined);
    await this.tagger.tagBill(bill.id).catch(() => undefined);

    return this.prisma.contributedBill.update({
      where: { id },
      data: {
        status: ContributionStatus.PUBLISHED,
        reviewerNote: reviewerNote ?? null,
        reviewedAt: new Date(),
        publishedBillId: bill.id,
      },
      include: { publishedBill: { include: { jurisdiction: { select: { slug: true } } } } },
    });
  }
}
