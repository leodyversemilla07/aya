import { z } from 'zod';
import { loadRootEnv } from './shared.js';

const authEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    BETTER_AUTH_SECRET: z.string().trim().optional(),
    BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === 'production' && !env.BETTER_AUTH_SECRET) {
      context.addIssue({
        code: 'custom',
        path: ['BETTER_AUTH_SECRET'],
        message: 'BETTER_AUTH_SECRET is required in production',
      });
    }
  });

export type AuthEnv = z.infer<typeof authEnvSchema>;

export function getAuthEnv(source: NodeJS.ProcessEnv = process.env): AuthEnv {
  loadRootEnv();
  const parsed = authEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid authentication environment:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
