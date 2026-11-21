import { prisma } from '@workspace/db';
import { getAuthEnv } from '@workspace/env';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';

export { normalizeUserRole, USER_ROLES, type UserRole } from './roles.js';

const env = getAuthEnv();
const baseURL = env.BETTER_AUTH_URL;
const secret = env.BETTER_AUTH_SECRET || 'development-only-secret-change-me';
const configuredAdminEmails = new Set(
  (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);
const databaseUrl = process.env.DATABASE_URL ?? '';
const provider = /^postgres(ql)?:\/\//i.test(databaseUrl) ? 'postgresql' : 'sqlite';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider,
  }),
  baseURL,
  secret,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: true,
        defaultValue: 'viewer',
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Local workspaces bootstrap their first administrator. Production
          // only grants the admin role to explicitly allowlisted email
          // addresses; every other self-service signup starts as a viewer.
          const existingUsers = await prisma.user.count();
          const isConfiguredAdmin = configuredAdminEmails.has(user.email.trim().toLowerCase());
          const isLocalBootstrap =
            env.NODE_ENV !== 'production' &&
            existingUsers === 0 &&
            configuredAdminEmails.size === 0;
          return {
            data: {
              ...user,
              role: isConfiguredAdmin || isLocalBootstrap ? 'admin' : 'viewer',
            },
          };
        },
      },
    },
  },
  trustedOrigins: [baseURL],
});

export type AuthSession = typeof auth.$Infer.Session;
