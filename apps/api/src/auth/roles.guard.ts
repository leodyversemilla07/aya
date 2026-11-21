import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from './request';
import { type UserRole, normalizeUserRole } from './roles';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // API keys are explicitly trusted internal-client credentials and retain
    // the same broad access they had before role enforcement was introduced.
    if (request.authType === 'api-key') return true;

    const role = normalizeUserRole((request.auth?.user as { role?: unknown } | undefined)?.role);
    if (!requiredRoles.includes(role)) {
      throw new ForbiddenException(
        `This action requires one of these roles: ${requiredRoles.join(', ')}.`,
      );
    }

    return true;
  }
}
