import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JurisdictionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const jurisdictions = await this.prisma.jurisdiction.findMany({
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { bills: true } } },
    });
    return jurisdictions.map((j) => ({
      slug: j.slug,
      name: j.name,
      type: j.type,
      stateCode: j.stateCode,
      websiteUrl: j.websiteUrl,
      billCount: j._count.bills,
    }));
  }

  async stats() {
    const [byJurisdiction, byStage, totalBills, totalSensitive] = await this.prisma.$transaction([
      this.prisma.bill.groupBy({
        by: ['jurisdictionId'],
        _count: { _all: true },
        orderBy: { jurisdictionId: 'asc' },
      }),
      this.prisma.bill.groupBy({
        by: ['currentStage'],
        _count: { _all: true },
        orderBy: { currentStage: 'asc' },
      }),
      this.prisma.bill.count(),
      this.prisma.bill.count({ where: { sensitiveFlag: true } }),
    ]);

    const jurisdictions = await this.prisma.jurisdiction.findMany({
      select: { id: true, slug: true, name: true, stateCode: true, type: true },
    });
    const jurisdictionMap = new Map(jurisdictions.map((j) => [j.id, j]));

    return {
      totalBills,
      totalSensitive,
      byStage: byStage.map((r) => ({ stage: r.currentStage, count: (r._count as { _all: number })._all })),
      byJurisdiction: byJurisdiction.map((r) => {
        const j = jurisdictionMap.get(r.jurisdictionId);
        return {
          slug: j?.slug,
          name: j?.name,
          stateCode: j?.stateCode,
          type: j?.type,
          count: (r._count as { _all: number })._all,
        };
      }),
    };
  }
}
