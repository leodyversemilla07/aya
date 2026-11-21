import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from './request';
import { RolesGuard } from './roles.guard';

function contextFor(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function guardFor(requiredRoles: string[] | undefined): RolesGuard {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows routes without role requirements', () => {
    const guard = guardFor(undefined);
    expect(guard.canActivate(contextFor({ authType: 'session' }))).toBe(true);
  });

  it('allows a session with an allowed role', () => {
    const guard = guardFor(['admin', 'manager']);
    const request = {
      authType: 'session',
      auth: { user: { role: 'manager' } },
    } as Partial<AuthenticatedRequest>;
    expect(guard.canActivate(contextFor(request))).toBe(true);
  });

  it('rejects a session without an allowed role', () => {
    const guard = guardFor(['admin', 'manager']);
    const request = {
      authType: 'session',
      auth: { user: { role: 'viewer' } },
    } as Partial<AuthenticatedRequest>;
    expect(() => guard.canActivate(contextFor(request))).toThrow(ForbiddenException);
  });

  it('keeps trusted API-key clients fully authorized', () => {
    const guard = guardFor(['admin']);
    expect(guard.canActivate(contextFor({ authType: 'api-key' }))).toBe(true);
  });
});
