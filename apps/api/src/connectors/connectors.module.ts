import { Module } from '@nestjs/common';
import { CpiConnector } from './cpi.connector';
import { IndicatorPipelineService } from './indicator-pipeline.service';

@Module({
  providers: [CpiConnector, IndicatorPipelineService],
  exports: [CpiConnector, IndicatorPipelineService],
})
export class ConnectorsModule {}
