import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AI_PROVIDER, type AIProvider } from './providers/ai-provider.interface';
import { TopicSource } from '@prisma/client';

@Injectable()
export class TaggerService {
  private readonly logger = new Logger(TaggerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
  ) {}

  async tagBill(billId: string): Promise<{ topicSlugs: string[] }> {
    const bill = await this.prisma.bill.findUnique({
      where: { id: billId },
      select: { id: true, title: true, fullText: true, summaryShort: true },
    });
    if (!bill) throw new Error(`Bill ${billId} not found`);

    const taxonomy = await this.prisma.topic.findMany({ select: { slug: true, name: true, id: true } });
    const { topics } = await this.ai.classifyTopics(
      { title: bill.title, fullText: bill.fullText ?? '', summary: bill.summaryShort ?? undefined },
      taxonomy.map((t) => ({ slug: t.slug, name: t.name })),
    );

    const slugToId = new Map(taxonomy.map((t) => [t.slug, t.id]));
    for (const t of topics) {
      const topicId = slugToId.get(t.slug);
      if (!topicId) continue;
      await this.prisma.billTopic.upsert({
        where: { billId_topicId: { billId, topicId } },
        update: { source: TopicSource.AI, confidence: t.confidence },
        create: { billId, topicId, source: TopicSource.AI, confidence: t.confidence },
      });
    }
    this.logger.log(`Tagged bill ${billId} with: ${topics.map((t) => t.slug).join(', ') || '(no topics matched)'}`);
    return { topicSlugs: topics.map((t) => t.slug) };
  }
}
