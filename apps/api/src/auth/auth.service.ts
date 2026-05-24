import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { createHash, randomInt } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { otpEmailHtml } from '../email/templates';

const OTP_TTL_MIN = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_REQUEST_COOLDOWN_SEC = 60;
const SESSION_TTL_DAYS = 30;

function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateCode(): string {
  // Avoid leading zeros for legibility, so range 100000..999999.
  return String(100000 + randomInt(900000));
}

function jwtSecret(): Uint8Array {
  const s = process.env.AUTH_JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error('AUTH_JWT_SECRET must be set and at least 16 chars long.');
  }
  return new TextEncoder().encode(s);
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async requestOtp(emailRaw: string): Promise<{ throttledSecondsLeft?: number; sent: boolean }> {
    const email = emailRaw.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Invalid email');
    }

    // Cooldown: only one request per email per 60 seconds.
    const recent = await this.prisma.otpCode.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      const ageSec = (Date.now() - recent.createdAt.getTime()) / 1000;
      if (ageSec < OTP_REQUEST_COOLDOWN_SEC) {
        return { throttledSecondsLeft: Math.ceil(OTP_REQUEST_COOLDOWN_SEC - ageSec), sent: false };
      }
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000);

    await this.prisma.otpCode.create({
      data: { email, codeHash: hashOtp(code), expiresAt },
    });

    const subject = 'Your Naija Bill Tracker sign-in code';
    const text =
      `Your sign-in code is: ${code}\n\n` +
      `It expires in ${OTP_TTL_MIN} minutes. If you didn't request this, ignore this email.`;
    const html = otpEmailHtml(code, OTP_TTL_MIN);

    const result = await this.email.send({
      to: email,
      subject,
      text,
      html,
      category: 'otp',
      metadata: { code, expiresAt: expiresAt.toISOString() },
    });

    if (result.delivered) {
      this.logger.log(`OTP sent to ${email} (provider id ${result.providerMessageId ?? '?'})`);
    } else {
      this.logger.log(`OTP queued for ${email} (delivery=${result.error ?? 'unknown'}). Code: ${code}`);
    }
    return { sent: true };
  }

  async verifyOtp(emailRaw: string, codeRaw: string): Promise<{ token: string; userId: string; isNew: boolean }> {
    const email = emailRaw.trim().toLowerCase();
    const code = codeRaw.trim();
    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException('Code must be 6 digits.');
    }

    const otp = await this.prisma.otpCode.findFirst({
      where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new UnauthorizedException('No valid code on file. Request a new one.');
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException('Too many attempts. Request a new code.');
    }

    if (hashOtp(code) !== otp.codeHash) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException(`Wrong code. ${OTP_MAX_ATTEMPTS - otp.attempts - 1} attempts left.`);
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    // Create or fetch user. First sign-in flips emailVerified to true.
    const existing = await this.prisma.user.findUnique({ where: { email } });
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: { emailVerified: true, lastLoginAt: new Date() },
        })
      : await this.prisma.user.create({
          data: { email, emailVerified: true, lastLoginAt: new Date() },
        });

    const token = await new SignJWT({ sub: user.id, email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${SESSION_TTL_DAYS}d`)
      .sign(jwtSecret());

    return { token, userId: user.id, isNew: !existing };
  }

  async verifyToken(token: string): Promise<{ userId: string; email: string }> {
    try {
      const { payload } = await jwtVerify(token, jwtSecret());
      return { userId: String(payload.sub), email: String(payload.email) };
    } catch {
      throw new UnauthorizedException('Invalid or expired session.');
    }
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        emailVerified: true,
        whatsappOptIn: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }

  async updateMe(userId: string, dto: { displayName?: string; whatsappOptIn?: boolean }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName,
        whatsappOptIn: dto.whatsappOptIn,
      },
      select: { id: true, email: true, displayName: true, whatsappOptIn: true },
    });
  }
}

export const SESSION_COOKIE = 'nbt_session';
export const SESSION_MAX_AGE_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
