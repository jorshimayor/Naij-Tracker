import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { BillStage, ExplainerStatus, SubscriptionFrequency } from '@prisma/client';
import { AdminService } from './admin.service';
import { ADMIN_COOKIE, AdminAuthGuard } from './admin-auth.guard';

class LoginDto {
  @IsString() @MinLength(4)
  token!: string;
}

class FlagDto {
  @IsString() @MinLength(3)
  reason!: string;
}

class ApproveDto {
  @IsOptional() @IsString()
  note?: string;
}

class SensitiveDto {
  @IsOptional()
  sensitive?: boolean;
}

class AdvanceStageDto {
  @IsEnum(BillStage) newStage!: BillStage;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

class TranslateDto {
  @IsString() targetLanguage!: string;
}

class RunDigestDto {
  @IsEnum(SubscriptionFrequency) frequency!: SubscriptionFrequency;
  @IsOptional() dryRun?: boolean;
}

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // --- Auth ---

  @Post('login')
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const expected = process.env.ADMIN_TOKEN;
    if (!expected) throw new UnauthorizedException('ADMIN_TOKEN not configured on the server');
    if (dto.token !== expected) throw new UnauthorizedException('Invalid admin token');

    // 12-hour session cookie. httpOnly so frontend JS can't read it; sameSite=lax to allow form
    // navigations from the same origin. For prod, set secure: true behind HTTPS.
    res.cookie(ADMIN_COOKIE, dto.token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000,
      path: '/',
    });
    return { ok: true };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ADMIN_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('session')
  @UseGuards(AdminAuthGuard)
  session() {
    // Marker route — if the guard passes, the session is valid. The guard rejects otherwise.
    return { ok: true };
  }

  // --- Editorial queue ---

  @Get('queue')
  @UseGuards(AdminAuthGuard)
  queue(@Query('status') status?: ExplainerStatus, @Query('jurisdiction') jurisdiction?: string) {
    if (status && !Object.values(ExplainerStatus).includes(status)) {
      throw new BadRequestException(`Unknown status: ${status}`);
    }
    return this.admin.getQueue({ status, jurisdiction });
  }

  @Get('bills/:id')
  @UseGuards(AdminAuthGuard)
  getBill(@Param('id') id: string) {
    return this.admin.getBillForReview(id);
  }

  @Get('audit-log')
  @UseGuards(AdminAuthGuard)
  auditLog() {
    return this.admin.getAuditLog(100);
  }

  @Get('mock-emails')
  @UseGuards(AdminAuthGuard)
  mockEmails(@Query('category') category?: string) {
    return this.admin.getMockEmails(100, category);
  }

  // --- Explainer actions ---

  @Post('explainers/:id/approve')
  @UseGuards(AdminAuthGuard)
  approve(@Param('id') id: string, @Body() dto: ApproveDto) {
    return this.admin.approve(id, 'admin', dto.note);
  }

  @Post('explainers/:id/flag')
  @UseGuards(AdminAuthGuard)
  flag(@Param('id') id: string, @Body() dto: FlagDto) {
    return this.admin.flag(id, 'admin', dto.reason);
  }

  @Post('explainers/:id/verify')
  @UseGuards(AdminAuthGuard)
  verify(@Param('id') id: string) {
    return this.admin.verify(id, 'admin');
  }

  @Post('explainers/:id/translate')
  @UseGuards(AdminAuthGuard)
  translate(@Param('id') id: string, @Body() dto: TranslateDto) {
    return this.admin.translate(id, 'admin', dto.targetLanguage);
  }

  @Post('bills/:id/sensitive')
  @UseGuards(AdminAuthGuard)
  setSensitive(@Param('id') id: string, @Body() dto: SensitiveDto) {
    return this.admin.setSensitive(id, 'admin', dto.sensitive === true);
  }

  @Post('bills/:id/advance-stage')
  @UseGuards(AdminAuthGuard)
  advanceStage(@Param('id') id: string, @Body() dto: AdvanceStageDto) {
    return this.admin.advanceStage(id, 'admin', { newStage: dto.newStage, note: dto.note });
  }

  @Post('digest/run')
  @UseGuards(AdminAuthGuard)
  runDigest(@Body() dto: RunDigestDto) {
    return this.admin.runDigest(dto.frequency, dto.dryRun === true);
  }
}
