import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

export const ADMIN_COOKIE = 'nbt_admin';

/**
 * Simple env-token auth for /api/admin/*.
 *
 * Production should replace this with a real user-role system (UserRole.EDITOR/ADMIN already
 * exists in the schema) — but for v0 a single shared admin token gates the editorial console.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expected = process.env.ADMIN_TOKEN;
    if (!expected) {
      throw new UnauthorizedException('ADMIN_TOKEN is not configured on the server.');
    }
    const cookieHeader = req.headers.cookie ?? '';
    const cookies = parseCookies(cookieHeader);
    const token = cookies[ADMIN_COOKIE] ?? '';
    if (!token || !constantTimeEq(token, expected)) {
      throw new UnauthorizedException('Not signed in.');
    }
    return true;
  }
}

export function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(/;\s*/)) {
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = decodeURIComponent(part.slice(eq + 1).trim());
    if (k) out[k] = v;
  }
  return out;
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
