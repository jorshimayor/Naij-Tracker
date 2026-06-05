import { Injectable, Logger } from '@nestjs/common';
import type {
  AIProvider,
  ExplainerInput,
  ExplainerOutput,
  TaggerInput,
  TaggerOutput,
  VerifyInput,
  VerifyOutput,
  TranslateExplainerInput,
  TranslateExplainerOutput,
  IndicatorExplainerInput,
  IndicatorExplainerOutput,
} from './ai-provider.interface';
import { buildExplainerPrompt, buildTaggingPrompt } from '../prompts/explainer.prompt';

/**
 * Real Anthropic Claude provider — stubbed in v0.
 *
 * To enable:
 *   1. Run: npm install @anthropic-ai/sdk -w @nbt/api
 *   2. Set ANTHROPIC_API_KEY in .env
 *   3. Set AI_PROVIDER=claude in .env
 *   4. Implement the marked sections below.
 *
 * Per PRD §8.6: Sonnet for explainers, Haiku for tagging. Cache by content hash, enforce
 * source-grounded output, return "unknown" when source material is missing.
 */
@Injectable()
export class ClaudeProvider implements AIProvider {
  private readonly logger = new Logger(ClaudeProvider.name);

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      this.logger.warn('ClaudeProvider instantiated without ANTHROPIC_API_KEY — calls will fail.');
    }
  }

  async generateExplainer(input: ExplainerInput): Promise<ExplainerOutput> {
    const _prompt = buildExplainerPrompt(input);
    // TODO: Replace this stub with a real call:
    //
    //   import Anthropic from '@anthropic-ai/sdk';
    //   const client = new Anthropic();
    //   const response = await client.messages.create({
    //     model: 'claude-sonnet-4-6',
    //     max_tokens: 4096,
    //     system: _prompt.system,
    //     messages: [{ role: 'user', content: _prompt.user }],
    //   });
    //   return parseExplainerJson(response.content);
    throw new Error(
      'ClaudeProvider not implemented. Set AI_PROVIDER=mock in .env, or finish the stub in apps/api/src/ai/providers/claude.provider.ts.',
    );
  }

  async classifyTopics(
    input: TaggerInput,
    taxonomy: { slug: string; name: string }[],
  ): Promise<TaggerOutput> {
    const _prompt = buildTaggingPrompt(input, taxonomy);
    // TODO: call Haiku for zero-shot classification — see prompts/explainer.prompt.ts.
    throw new Error('ClaudeProvider.classifyTopics not implemented in v0.');
  }

  async verifyExplainer(_input: VerifyInput): Promise<VerifyOutput> {
    throw new Error('ClaudeProvider.verifyExplainer not implemented in v0.');
  }

  async translateExplainer(_input: TranslateExplainerInput): Promise<TranslateExplainerOutput> {
    throw new Error('ClaudeProvider.translateExplainer not implemented in v0.');
  }

  async explainIndicator(_input: IndicatorExplainerInput): Promise<IndicatorExplainerOutput> {
    // TODO: Build a prompt that includes the full observation series and requires the model to
    // cite the latest figure verbatim. Forbid speculative drivers ("likely caused by X") unless
    // the prompt is enriched with concurrent indicators or news (deferred to v1).
    throw new Error('ClaudeProvider.explainIndicator not implemented in v0.');
  }
}
