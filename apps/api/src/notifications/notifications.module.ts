import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { DigestService } from './digest.service';

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [NotificationsService, DigestService],
  exports: [NotificationsService, DigestService],
})
export class NotificationsModule {}
