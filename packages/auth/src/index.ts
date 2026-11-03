import { prisma } from '@workspace/db';
import { getAuthEnv } from '@workspace/env';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';

const env = getAuthEnv();
const baseURL = env.BETTER_AUTH_URL;
const secret = env.BETTER_AUTH_SECRET || 'development-only-secret-change-me';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'sqlite',
  }),
  baseURL,
  secret,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  trustedOrigins: [baseURL],
});

export type AuthSession = typeof auth.$Infer.Session;
