import { SetMetadata } from '@nestjs/common';
import { type UserRole } from './roles';

export const ROLES_KEY = 'aya:roles';

/** Restricts a route to the listed workspace roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
