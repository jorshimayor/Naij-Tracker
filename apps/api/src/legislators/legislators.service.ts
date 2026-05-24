import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LegislatorsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const legislators = await this.prisma.legislator.findMany({
      orderBy: { fullName: 'asc' },
      include: { _count: { select: { sponsorships: true } } },
    });
    return legislators.map((l) => ({
      slug: l.slug,
      fullName: l.fullName,
      party: l.party,
      chamber: l.chamber,
      constituency: l.constituency,
      state: l.state,
      photoUrl: l.photoUrl,
      sponsorshipCount: l._count.sponsorships,
    }));
  }

  async getBySlug(slug: string) {
    const legislator = await this.prisma.legislator.findUnique({
      where: { slug },
      include: {
        sponsorships: {
          include: {
            bill: {
              include: {
                jurisdiction: { select: { slug: true, name: true } },
                topics: { include: { topic: { select: { slug: true, name: true } } } },
              },
            },
          },
          orderBy: { bill: { lastActionDate: 'desc' } },
        },
      },
    });
    if (!legislator) throw new NotFoundException(`Legislator "${slug}" not found`);

    return {
      slug: legislator.slug,
      fullName: legislator.fullName,
      party: legislator.party,
      chamber: legislator.chamber,
      constituency: legislator.constituency,
      state: legislator.state,
      photoUrl: legislator.photoUrl,
      contactEmail: legislator.contactEmail,
      phone: legislator.phone,
      socialLinks: legislator.socialLinks,
      bills: legislator.sponsorships.map((s) => ({
        role: s.role,
        bill: {
          billNumber: s.bill.billNumber,
          title: s.bill.title,
          slug: s.bill.slug,
          summaryShort: s.bill.summaryShort,
          currentStage: s.bill.currentStage,
          lastActionDate: s.bill.lastActionDate,
          jurisdiction: s.bill.jurisdiction,
          topics: s.bill.topics.map((t) => t.topic),
        },
      })),
    };
  }
}
