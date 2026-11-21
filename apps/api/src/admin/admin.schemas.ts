import { z } from 'zod';
import { USER_ROLES } from '../auth/roles';

export const adminUserListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  role: z.enum(USER_ROLES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(USER_ROLES),
});

export const auditLogListQuerySchema = z.object({
  action: z.enum(['create', 'update', 'delete', 'scan']).optional(),
  entityType: z.string().trim().max(80).optional(),
  entityId: z.string().trim().max(120).optional(),
  actorId: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
