import { Module, Controller, Get } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { BillsModule } from './bills/bills.module';
import { LegislatorsModule } from './legislators/legislators.module';
import { TopicsModule } from './topics/topics.module';
import { JurisdictionsModule } from './jurisdictions/jurisdictions.module';
import { AiModule } from './ai/ai.module';
import { ScrapersModule } from './scrapers/scrapers.module';
import { RepresentativesModule } from './representatives/representatives.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { CommentsModule } from './comments/comments.module';
import { ContributionsModule } from './contributions/contributions.module';
import { EmailModule } from './email/email.module';
import { NotificationsModule } from './notifications/notifications.module';

@Controller('health')
class HealthController {
  @Get()
  ping() {
    return { status: 'ok', service: 'nbt-api', time: new Date().toISOString() };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EmailModule,
    NotificationsModule,
    AiModule,
    BillsModule,
    LegislatorsModule,
    TopicsModule,
    JurisdictionsModule,
    ScrapersModule,
    RepresentativesModule,
    AdminModule,
    AuthModule,
    SubscriptionsModule,
    CommentsModule,
    ContributionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
