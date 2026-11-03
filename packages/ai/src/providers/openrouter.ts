import { getProviderConfig } from '../index.js';
import { type AiProvider, createProvider } from '../models.js';

export function openrouterProvider(env: NodeJS.ProcessEnv = process.env): AiProvider {
  return createProvider(getProviderConfig('openrouter', env), 'OpenRouter');
}
