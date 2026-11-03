import { z } from 'zod';
import { loadRootEnv } from './shared.js';

const webEnvSchema = z.object({
  AYA_API_URL: z.string().url().default('http://localhost:3001'),
  API_URL: z.string().url().optional(),
  AYA_API_KEY: z.string().trim().optional(),
  AYA_ALLOWED_ORIGINS: z.string().optional().default(''),
  BETTER_AUTH_SECRET: z.string().trim().optional(),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
});

export type WebEnv = Omit<z.infer<typeof webEnvSchema>, 'AYA_ALLOWED_ORIGINS'> & {
  AYA_ALLOWED_ORIGINS: string[];
};

export function getWebEnv(source: NodeJS.ProcessEnv = process.env): WebEnv {
  loadRootEnv();
  const parsed = webEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid web environment:\n${z.prettifyError(parsed.error)}`);
  }
  return {
    ...parsed.data,
    AYA_ALLOWED_ORIGINS: parsed.data.AYA_ALLOWED_ORIGINS.split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

export { webEnvSchema };
