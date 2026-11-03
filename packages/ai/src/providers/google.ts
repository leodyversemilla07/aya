import { getProviderConfig } from '../index.js';
import { type AiProvider, createProvider } from '../models.js';

export function googleProvider(env: NodeJS.ProcessEnv = process.env): AiProvider {
  return createProvider(getProviderConfig('google', env), 'Google Gemini');
}
