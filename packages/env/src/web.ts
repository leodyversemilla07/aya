import { z } from 'zod';
import { loadRootEnv } from './shared.js';

const webEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3001'),
  API_URL: z.string().url().optional(),
  BETTER_AUTH_SECRET: z.string().trim().optional(),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export function getWebEnv(source: NodeJS.ProcessEnv = process.env): WebEnv {
  loadRootEnv();
  const parsed = webEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid web environment:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export { webEnvSchema };
