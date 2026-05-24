import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, SESSION_COOKIE } from './auth.service';
import { parseCookies } from '../admin/admin-auth.guard';

export interface AuthedRequest extends Request {
  user?: { userId: string; email: string };
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const cookies = parseCookies(req.headers.cookie ?? '');
    const token = cookies[SESSION_COOKIE];
    if (!token) throw new UnauthorizedException('Not signed in.');
    req.user = await this.auth.verifyToken(token);
    return true;
  }
}

/** For optional auth: attaches user if cookie is valid, otherwise leaves it undefined. */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const cookies = parseCookies(req.headers.cookie ?? '');
    const token = cookies[SESSION_COOKIE];
    if (token) {
      try {
        req.user = await this.auth.verifyToken(token);
      } catch {
        // ignore — anonymous
      }
    }
    return true;
  }
}
