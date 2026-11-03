import { getProviderConfig } from '../index.js';
import { type AiProvider, createProvider } from '../models.js';

export function anthropicProvider(env: NodeJS.ProcessEnv = process.env): AiProvider {
  return createProvider(getProviderConfig('anthropic', env), 'Anthropic');
}
