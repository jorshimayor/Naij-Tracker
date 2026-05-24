import { Module } from '@nestjs/common';
import { SenateScraper } from './senate.scraper';
import { RepsScraper } from './reps.scraper';
import { LagosScraper } from './lagos.scraper';
import { PipelineService } from './pipeline.service';

@Module({
  providers: [SenateScraper, RepsScraper, LagosScraper, PipelineService],
  exports: [SenateScraper, RepsScraper, LagosScraper, PipelineService],
})
export class ScrapersModule {}
