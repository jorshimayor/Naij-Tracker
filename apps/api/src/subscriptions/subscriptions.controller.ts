import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SubscriptionChannel, SubscriptionFrequency, SubscriptionTarget } from '@prisma/client';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard';
import { SubscriptionsService } from './subscriptions.service';

class CreateSubscriptionDto {
  @IsEnum(SubscriptionTarget) targetType!: SubscriptionTarget;
  @IsString() targetId!: string;
  @IsOptional() @IsEnum(SubscriptionChannel) channel?: SubscriptionChannel;
  @IsOptional() @IsEnum(SubscriptionFrequency) frequency?: SubscriptionFrequency;
}

@ApiTags('subscriptions')
@Controller('subscriptions')
@UseGuards(AuthGuard)
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.subs.list(req.user!.userId);
  }

  @Get('check')
  async check(
    @Req() req: AuthedRequest,
    @Query('targetType') targetType: SubscriptionTarget,
    @Query('targetId') targetId: string,
  ) {
    const following = await this.subs.hasSubscription(req.user!.userId, targetType, targetId);
    return { following };
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateSubscriptionDto) {
    return this.subs.create(req.user!.userId, dto);
  }

  @Delete(':id')
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.subs.remove(req.user!.userId, id);
  }
}
