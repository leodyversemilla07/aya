import { PrismaClient } from '@prisma/client';

export { Prisma } from '@prisma/client';
export type {
  AlertDelivery,
  Assignment,
  AuditLog,
  Client,
  Contact,
  Contract,
  Conversation,
  Developer,
  Message,
  Notification,
  NotificationRead,
  Performance,
  Skill,
  StaffingAlert,
  User,
  WorkerLease,
} from '@prisma/client';

export {
  type CaseInsensitiveContainsFilter,
  containsIgnoreCase,
  isPostgresProvider,
} from './filters.js';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
