import { PrismaClient } from '@prisma/client';

export { Prisma } from '@prisma/client';
export type {
  Assignment,
  Client,
  Contact,
  Contract,
  Conversation,
  Developer,
  Message,
  Performance,
  Skill,
} from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
