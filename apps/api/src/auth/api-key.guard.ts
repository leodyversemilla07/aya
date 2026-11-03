import { timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getServerEnv } from '@workspace/env';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';

function safeCompare(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) {
    // Compare against itself to keep the work factor similar for bad lengths.
    timingSafeEqual(expectedBuffer, expectedBuffer);
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const env = getServerEnv();
    const configuredKey = env.API_KEY;
    const request = context.switchToHttp().getRequest<Request>();
    if (env.NODE_ENV !== 'test') {
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers)) {
        if (typeof value === 'string') headers.set(name, value);
      }

      const { auth } = await import('@workspace/auth');
      const session = await auth.api.getSession({ headers });
      if (session) {
        (request as Request & { auth?: typeof session }).auth = session;
        return true;
      }
    }

    if (!configuredKey) {
      this.logger.error('API_KEY is not configured; rejecting a protected request.');
      throw new UnauthorizedException('A valid x-api-key header is required.');
    }

    const providedKey =
      request.header('x-api-key')?.trim() ||
      request
        .header('authorization')
        ?.replace(/^Bearer\s+/i, '')
        .trim();

    if (!providedKey || !safeCompare(configuredKey, providedKey)) {
      this.logger.warn(`Rejected unauthenticated request to ${request.method} ${request.url}`);
      throw new UnauthorizedException('A valid x-api-key header is required.');
    }

    return true;
  }
}
