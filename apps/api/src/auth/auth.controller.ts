import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import type { Request, Response } from 'express';
import { AuthService, SESSION_COOKIE, SESSION_MAX_AGE_MS } from './auth.service';
import { AuthGuard, type AuthedRequest } from './auth.guard';

class RequestOtpDto {
  @IsEmail() email!: string;
}

class VerifyOtpDto {
  @IsEmail() email!: string;
  @IsString() @Length(6, 6) code!: string;
}

class UpdateMeDto {
  @IsOptional() @IsString() @MaxLength(80) displayName?: string;
  @IsOptional() @IsBoolean() whatsappOptIn?: boolean;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('request-otp')
  async requestOtp(@Body() dto: RequestOtpDto) {
    const r = await this.auth.requestOtp(dto.email);
    return r;
  }

  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    const { token, userId, isNew } = await this.auth.verifyOtp(dto.email, dto.code);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE_MS,
      path: '/',
    });
    return { ok: true, userId, isNew };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: AuthedRequest) {
    return this.auth.getMe(req.user!.userId);
  }

  @Post('me')
  @UseGuards(AuthGuard)
  updateMe(@Req() req: AuthedRequest, @Body() dto: UpdateMeDto) {
    return this.auth.updateMe(req.user!.userId, dto);
  }
}
