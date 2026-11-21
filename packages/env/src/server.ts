import { z } from 'zod';
import { csv, nodeEnvSchema } from './shared.js';
import { loadRootEnv } from './shared.js';

const emptyStringToUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const serverEnvSchema = z
  .object({
    NODE_ENV: nodeEnvSchema,
    DATABASE_URL: z.string().trim().min(1).default('file:./dev.db'),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    API_KEY: z.string().trim().optional(),
    API_KEYS: z.string().optional(),
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
    ALERT_SCAN_INTERVAL_MS: z.coerce.number().int().min(5_000).default(60_000),
    ALERT_LEASE_SECONDS: z.coerce.number().int().min(10).default(60),
    ALERT_WEBHOOK_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
    ALERT_WEBHOOK_SECRET: z.preprocess(
      emptyStringToUndefined,
      z.string().trim().min(16).optional(),
    ),
    ALERT_WEBHOOK_TIMEOUT_MS: z.coerce.number().int().min(1_000).default(10_000),
    ALERT_WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
    METRICS_TOKEN: z.preprocess(emptyStringToUndefined, z.string().trim().min(16).optional()),
    BETTER_AUTH_SECRET: z.string().trim().optional(),
    BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
    API_URL: z.string().url().optional(),
    SEED_FORCE: z.string().optional(),
    SEED_RESET_CONVERSATIONS: z.string().optional(),
  })
  .superRefine((env, context) => {
    if (env.CORS_ORIGINS.split(',').some((origin) => origin.trim() === '*')) {
      context.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'Wildcard CORS origins are not allowed when credentialed CORS is enabled',
      });
    }
    if (env.ALERT_WEBHOOK_URL && !env.ALERT_WEBHOOK_SECRET) {
      context.addIssue({
        code: 'custom',
        path: ['ALERT_WEBHOOK_SECRET'],
        message: 'ALERT_WEBHOOK_SECRET is required when ALERT_WEBHOOK_URL is configured',
      });
    }
    if (env.ALERT_WEBHOOK_SECRET && !env.ALERT_WEBHOOK_URL) {
      context.addIssue({
        code: 'custom',
        path: ['ALERT_WEBHOOK_URL'],
        message: 'ALERT_WEBHOOK_URL is required when ALERT_WEBHOOK_SECRET is configured',
      });
    }
    if (env.NODE_ENV === 'production') {
      if (!env.API_KEY && !env.API_KEYS?.trim()) {
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

export type ServerEnv = Omit<z.infer<typeof serverEnvSchema>, 'CORS_ORIGINS' | 'API_KEYS'> & {
  CORS_ORIGINS: string[];
  API_KEYS: string[];
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
    API_KEYS: csv(parsed.data.API_KEYS),
  };
}

export { serverEnvSchema };
