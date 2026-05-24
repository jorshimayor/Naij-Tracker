import { Injectable, Inject, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AI_PROVIDER, type AIProvider, type ExplainerInput } from './providers/ai-provider.interface';
import { ExplainerStatus } from '@prisma/client';

const SUPPORTED_TRANSLATION_LANGS: Record<string, string> = {
  yo: 'Yoruba',
  ig: 'Igbo',
  ha: 'Hausa',
  pcm: 'Nigerian Pidgin',
};

@Injectable()
export class ExplainerService {
  private readonly logger = new Logger(ExplainerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
  ) {}

  /**
   * Generate (or regenerate) an explainer for a bill. Idempotent on content hash:
   * if the bill text hasn't changed since the last explainer, we return the existing record.
   */
  async generateForBill(billId: string): Promise<{ explainerId: string; sensitive: boolean }> {
    const bill = await this.prisma.bill.findUnique({
      where: { id: billId },
      include: {
        jurisdiction: true,
        sponsors: { include: { legislator: true } },
        documents: true,
      },
    });
    if (!bill) throw new Error(`Bill ${billId} not found`);

    const existing = await this.prisma.aIExplainer.findFirst({
      where: { billId, language: 'en' },
      orderBy: { version: 'desc' },
    });
    if (existing && bill.contentHash && existing.modelUsed.endsWith(bill.contentHash)) {
      return { explainerId: existing.id, sensitive: bill.sensitiveFlag };
    }

    const input: ExplainerInput = {
      billNumber: bill.billNumber,
      title: bill.title,
      jurisdictionName: bill.jurisdiction.name,
      sponsors: bill.sponsors.map((s) => s.legislator.fullName),
      fullText: bill.fullText ?? '',
      summaryShort: bill.summaryShort ?? undefined,
      sourceUrls: bill.documents.map((d) => d.url).filter((u): u is string => !!u),
    };

    const output = await this.ai.generateExplainer(input);
    this.logger.log(`Generated explainer for ${bill.billNumber} (sensitive=${output.sensitive})`);

    const status: ExplainerStatus = output.sensitive
      ? ExplainerStatus.PENDING_REVIEW
      : ExplainerStatus.AUTO_APPROVED;

    const nextVersion = (existing?.version ?? 0) + 1;
    const created = await this.prisma.aIExplainer.create({
      data: {
        billId,
        version: nextVersion,
        tldr: output.tldr,
        plainEnglish: output.plainEnglish,
        howItAffectsYou: output.howItAffectsYou,
        argumentsFor: output.argumentsFor,
        argumentsAgainst: output.argumentsAgainst,
        jargonTerms: output.jargonTerms,
        sourceCitations: output.sourceCitations,
        status,
        modelUsed: `${output.modelUsed}:${bill.contentHash ?? 'no-hash'}`,
        language: 'en',
      },
    });

    if (output.sensitive && !bill.sensitiveFlag) {
      await this.prisma.bill.update({
        where: { id: billId },
        data: { sensitiveFlag: true },
      });
    }

    return { explainerId: created.id, sensitive: output.sensitive };
  }

  /**
   * Translate an existing English explainer into one of the supported Nigerian languages
   * (Yoruba/Igbo/Hausa/Pidgin). Stores the result as a new AIExplainer row sharing the same
   * version as the English source. Idempotent: returns the existing row if one is already on file
   * for the same (bill, version, language).
   */
  async translateForBill(
    billId: string,
    targetLanguage: string,
  ): Promise<{ explainerId: string; created: boolean }> {
    if (!SUPPORTED_TRANSLATION_LANGS[targetLanguage]) {
      throw new BadRequestException(
        `Unsupported language "${targetLanguage}". Supported: ${Object.keys(SUPPORTED_TRANSLATION_LANGS).join(', ')}`,
      );
    }

    const source = await this.prisma.aIExplainer.findFirst({
      where: { billId, language: 'en' },
      orderBy: { version: 'desc' },
      include: { bill: { select: { billNumber: true, title: true } } },
    });
    if (!source) {
      throw new NotFoundException(`No English explainer to translate for bill ${billId}`);
    }

    const existing = await this.prisma.aIExplainer.findUnique({
      where: { billId_version_language: { billId, version: source.version, language: targetLanguage } },
    });
    if (existing) {
      return { explainerId: existing.id, created: false };
    }

    const howItAffects = Array.isArray(source.howItAffectsYou)
      ? (source.howItAffectsYou as unknown as string[]).filter((x) => typeof x === 'string')
      : [];
    const argsFor = Array.isArray(source.argumentsFor)
      ? (source.argumentsFor as unknown as string[]).filter((x) => typeof x === 'string')
      : [];
    const argsAgainst = Array.isArray(source.argumentsAgainst)
      ? (source.argumentsAgainst as unknown as string[]).filter((x) => typeof x === 'string')
      : [];
    const jargon = Array.isArray(source.jargonTerms)
      ? (source.jargonTerms as unknown as { term: string; definition: string }[]).filter(
          (j) => j && typeof j.term === 'string' && typeof j.definition === 'string',
        )
      : [];

    const output = await this.ai.translateExplainer({
      billNumber: source.bill.billNumber,
      billTitle: source.bill.title,
      sourceLanguage: 'en',
      targetLanguage,
      targetLanguageName: SUPPORTED_TRANSLATION_LANGS[targetLanguage],
      tldr: source.tldr,
      plainEnglish: source.plainEnglish,
      howItAffectsYou: howItAffects,
      argumentsFor: argsFor,
      argumentsAgainst: argsAgainst,
      jargonTerms: jargon,
    });

    // Translations inherit the source's review status — if the English version was approved by an
    // editor, the translation is auto-published; otherwise it goes into pending review too.
    const created = await this.prisma.aIExplainer.create({
      data: {
        billId,
        version: source.version,
        tldr: output.tldr,
        plainEnglish: output.plainEnglish,
        howItAffectsYou: output.howItAffectsYou,
        argumentsFor: output.argumentsFor,
        argumentsAgainst: output.argumentsAgainst,
        jargonTerms: output.jargonTerms,
        sourceCitations: source.sourceCitations as any, // citations don't translate
        status: source.status,
        modelUsed: `${output.modelUsed}:translated-from-en`,
        language: targetLanguage,
      },
    });

    this.logger.log(
      `Translated explainer for ${source.bill.billNumber} → ${targetLanguage} (id=${created.id})`,
    );
    return { explainerId: created.id, created: true };
  }
}
