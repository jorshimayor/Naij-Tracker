import { Module } from '@nestjs/common';
import { NassSenateScraper } from './nass-senate.scraper';
import { LegislatorPipelineService } from './legislator-pipeline.service';

@Module({
  providers: [NassSenateScraper, LegislatorPipelineService],
  exports: [NassSenateScraper, LegislatorPipelineService],
})
export class LegislatorScrapersModule {}
