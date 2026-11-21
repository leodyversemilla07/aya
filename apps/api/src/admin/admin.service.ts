import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, containsIgnoreCase, prisma } from '@workspace/db';
import type { z } from 'zod';
import { type AuditActor, writeAudit } from '../audit/audit';
import { normalizeUserRole } from '../auth/roles';
import type {
  adminUserListQuerySchema,
  auditLogListQuerySchema,
  updateUserRoleSchema,
} from './admin.schemas';

type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;
type AuditLogListQuery = z.infer<typeof auditLogListQuerySchema>;
type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

function parseState(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

@Injectable()
export class AdminService {
  async listUsers(query: AdminUserListQuery) {
    const where: Prisma.UserWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: containsIgnoreCase(query.search) },
        { email: containsIgnoreCase(query.search) },
      ];
    }
    if (query.role) where.role = query.role;

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.offset,
        take: query.limit,
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return {
      total,
      limit: query.limit,
      offset: query.offset,
      items: users.map((user) => ({
        ...user,
        role: normalizeUserRole(user.role),
      })),
    };
  }

  async updateUserRole(
    id: string,
    input: UpdateUserRoleInput,
    actor: AuditActor,
    requestId?: string,
  ) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const updated = await prisma.$transaction(
          async (tx) => {
            const existing = await tx.user.findUnique({ where: { id } });
            if (!existing) throw new NotFoundException(`User "${id}" was not found.`);

            const currentRole = normalizeUserRole(existing.role);
            if (currentRole === input.role) {
              return {
                id: existing.id,
                name: existing.name,
                email: existing.email,
                role: currentRole,
                updatedAt: existing.updatedAt,
              };
            }

            if (currentRole === 'admin') {
              const adminCount = await tx.user.count({ where: { role: 'admin' } });
              if (adminCount <= 1) {
                throw new BadRequestException(
                  'The workspace must keep at least one administrator.',
                );
              }
            }

            const user = await tx.user.update({
              where: { id },
              data: { role: input.role },
              select: { id: true, name: true, email: true, role: true, updatedAt: true },
            });
            await writeAudit(tx, actor, {
              action: 'update',
              entityType: 'user',
              entityId: id,
              before: { id: existing.id, email: existing.email, role: currentRole },
              after: { id: user.id, email: user.email, role: input.role },
              requestId,
            });
            return user;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );

        return { ...updated, role: normalizeUserRole(updated.role) };
      } catch (error) {
        // Serializable role changes can conflict when two administrators are
        // demoted concurrently. Retry once so the final admin check remains
        // authoritative under concurrent requests.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt === 0
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new Error('The role update could not be completed.');
  }

  async listAuditLogs(query: AuditLogListQuery) {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.action) where.action = query.action;
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.actorId) where.actorId = query.actorId;

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.offset,
        take: query.limit,
        include: {
          actor: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
    ]);

    return {
      total,
      limit: query.limit,
      offset: query.offset,
      items: logs.map((log) => ({
        id: log.id,
        actor: log.actor
          ? {
              id: log.actor.id,
              name: log.actor.name,
              email: log.actor.email,
              role: normalizeUserRole(log.actor.role),
            }
          : null,
        actorType: log.actorType,
        actorName: log.actorName,
        actorKey: log.actorKey,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        before: parseState(log.beforeState),
        after: parseState(log.afterState),
        requestId: log.requestId,
        createdAt: log.createdAt,
      })),
    };
  }
}
