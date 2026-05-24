import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const topics = await this.prisma.topic.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { bills: true } } },
    });
    return topics.map((t) => ({
      slug: t.slug,
      name: t.name,
      billCount: t._count.bills,
    }));
  }

  async getBySlug(slug: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { slug },
      include: {
        bills: {
          orderBy: { bill: { lastActionDate: 'desc' } },
          include: {
            bill: {
              include: {
                jurisdiction: { select: { slug: true, name: true } },
                sponsors: {
                  include: { legislator: { select: { slug: true, fullName: true, party: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!topic) throw new NotFoundException(`Topic "${slug}" not found`);

    return {
      slug: topic.slug,
      name: topic.name,
      bills: topic.bills.map((bt) => ({
        billNumber: bt.bill.billNumber,
        title: bt.bill.title,
        slug: bt.bill.slug,
        summaryShort: bt.bill.summaryShort,
        currentStage: bt.bill.currentStage,
        lastActionDate: bt.bill.lastActionDate,
        jurisdiction: bt.bill.jurisdiction,
        primarySponsor: bt.bill.sponsors[0]?.legislator,
        confidence: bt.confidence,
      })),
    };
  }
}
