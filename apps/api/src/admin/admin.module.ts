import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { TavilyService } from './tavily.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, TavilyService],
})
export class AdminModule {}
