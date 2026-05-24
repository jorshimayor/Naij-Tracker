import { Global, Module, Logger } from '@nestjs/common';
import { ExplainerService } from './explainer.service';
import { TaggerService } from './tagger.service';
import { MockClaudeProvider } from './providers/mock-claude.provider';
import { ClaudeProvider } from './providers/claude.provider';
import { OpenAICompatibleProvider } from './providers/openai-compatible.provider';
import { AI_PROVIDER } from './providers/ai-provider.interface';

const OPENAI_COMPAT = new Set(['groq', 'deepseek', 'openrouter', 'gemini', 'openai']);

@Global()
@Module({
  providers: [
    MockClaudeProvider,
    ClaudeProvider,
    OpenAICompatibleProvider,
    {
      provide: AI_PROVIDER,
      useFactory: (mock: MockClaudeProvider, claude: ClaudeProvider, oai: OpenAICompatibleProvider) => {
        const choice = (process.env.AI_PROVIDER ?? 'mock').toLowerCase();
        const logger = new Logger('AiModule');
        if (choice === 'claude') {
          logger.log('AI provider: Claude (live)');
          return claude;
        }
        if (OPENAI_COMPAT.has(choice)) {
          logger.log(`AI provider: ${choice} via OpenAI-compatible API`);
          return oai;
        }
        logger.log(`AI provider: ${choice} (using MockClaudeProvider)`);
        return mock;
      },
      inject: [MockClaudeProvider, ClaudeProvider, OpenAICompatibleProvider],
    },
    ExplainerService,
    TaggerService,
  ],
  exports: [ExplainerService, TaggerService, AI_PROVIDER],
})
export class AiModule {}
