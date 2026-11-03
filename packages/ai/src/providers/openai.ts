import { getProviderConfig } from '../index.js';
import { type AiProvider, createProvider } from '../models.js';

export function openaiProvider(env: NodeJS.ProcessEnv = process.env): AiProvider {
  return createProvider(getProviderConfig('openai', env), 'OpenAI');
}
