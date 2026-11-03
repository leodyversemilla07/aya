import { getProviderConfig } from '../index.js';
import { type AiProvider, createProvider } from '../models.js';

export function opencodeZenProvider(env: NodeJS.ProcessEnv = process.env): AiProvider {
  return createProvider(getProviderConfig('opencode-zen', env), 'OpenCode Zen');
}
