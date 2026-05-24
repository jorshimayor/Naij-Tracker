import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, Length, MaxLength, MinLength } from 'class-validator';
import { ContributionStatus } from '@prisma/client';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { ContributionsService } from './contributions.service';

class SubmitContributionDto {
  @IsString() @Length(2, 32) jurisdictionSlug!: string;
  @IsString() @Length(1, 32) billNumber!: string;
  @IsString() @Length(8, 500) title!: string;
  @IsOptional() @IsString() @MaxLength(800) summary?: string;
  @IsOptional() @IsUrl() @MaxLength(500) sourceUrl?: string;
  @IsOptional() @IsString() @MaxLength(40000) fullText?: string;
  @IsOptional() @IsString() @MaxLength(2000) submitterNote?: string;
}

class ReviewDto {
  @IsOptional() @IsString() @MaxLength(2000) reviewerNote?: string;
}

class RejectDto {
  @IsString() @MinLength(3) @MaxLength(2000) reviewerNote!: string;
}

@ApiTags('contributions')
@Controller('contributions')
export class ContributionsController {
  constructor(private readonly contributions: ContributionsService) {}

  @Post()
  @UseGuards(AuthGuard)
  submit(@Req() req: AuthedRequest, @Body() dto: SubmitContributionDto) {
    return this.contributions.submit(req.user!.userId, dto);
  }

  @Get('mine')
  @UseGuards(AuthGuard)
  mine(@Req() req: AuthedRequest) {
    return this.contributions.listMine(req.user!.userId);
  }

  // --- Admin endpoints ---

  @Get('admin/queue')
  @UseGuards(AdminAuthGuard)
  adminList(@Query('status') status?: ContributionStatus) {
    return this.contributions.listForReview(status);
  }

  @Get('admin/:id')
  @UseGuards(AdminAuthGuard)
  adminDetail(@Param('id') id: string) {
    return this.contributions.getDetail(id);
  }

  @Post('admin/:id/approve')
  @UseGuards(AdminAuthGuard)
  approve(@Param('id') id: string, @Body() dto: ReviewDto) {
    return this.contributions.approveAndPublish(id, dto.reviewerNote);
  }

  @Post('admin/:id/reject')
  @UseGuards(AdminAuthGuard)
  reject(@Param('id') id: string, @Body() dto: RejectDto) {
    return this.contributions.reject(id, dto.reviewerNote);
  }
}
