import { z } from 'zod';
import type { nodeEnvSchema } from './shared.js';
export { csv, loadRootEnv, nodeEnvSchema } from './shared.js';

export function requiredSecret(name: string) {
  return z.string().trim().min(1, `${name} is required`);
}

export function optionalString() {
  return z.string().trim().optional();
}

export type NodeEnv = z.infer<typeof nodeEnvSchema>;

export { getServerEnv, serverEnvSchema, type ServerEnv } from './server.js';
export { getWebEnv, webEnvSchema, type WebEnv } from './web.js';
export { getAuthEnv, type AuthEnv } from './auth.js';
