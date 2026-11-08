import { z } from 'zod';
import { csv, nodeEnvSchema } from './shared.js';
import { loadRootEnv } from './shared.js';

const serverEnvSchema = z
  .object({
    NODE_ENV: nodeEnvSchema,
    DATABASE_URL: z.string().trim().min(1).default('file:./dev.db'),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    API_KEY: z.string().trim().optional(),
    CORS_ORIGINS: z.string().optional().default('http://localhost:3000'),
    TRUST_PROXY: z.enum(['true', 'false']).default('false'),
    LLM_PROVIDER: z
      .enum(['openai', 'openrouter', 'opencode-zen', 'anthropic', 'google', 'custom'])
      .default('opencode-zen'),
    LLM_API_KEY: z.string().trim().optional(),
    LLM_BASE_URL: z.string().url().optional(),
    LLM_MODEL: z.string().trim().min(1).optional(),
    LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
    LLM_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
    LLM_MAX_TOKENS: z.coerce.number().int().positive().default(4096),
    AGENT_TIMEOUT_MS: z.coerce.number().int().positive().default(180_000),
    CHAT_DAILY_QUOTA: z.coerce.number().int().min(0).default(200),
    BETTER_AUTH_SECRET: z.string().trim().optional(),
    BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
    API_URL: z.string().url().optional(),
    SEED_FORCE: z.string().optional(),
    SEED_RESET_CONVERSATIONS: z.string().optional(),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === 'production') {
      if (!env.API_KEY) {
        context.addIssue({
          code: 'custom',
          path: ['API_KEY'],
          message: 'API_KEY is required in production',
        });
      }
      if (!env.BETTER_AUTH_SECRET) {
        context.addIssue({
          code: 'custom',
          path: ['BETTER_AUTH_SECRET'],
          message: 'BETTER_AUTH_SECRET is required in production',
        });
      }
    }
  });

export type ServerEnv = Omit<z.infer<typeof serverEnvSchema>, 'CORS_ORIGINS'> & {
  CORS_ORIGINS: string[];
};

export function getServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  loadRootEnv();
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid server environment:\n${z.prettifyError(parsed.error)}`);
  }
  return {
    ...parsed.data,
    CORS_ORIGINS: csv(parsed.data.CORS_ORIGINS),
  };
}

export { serverEnvSchema };
