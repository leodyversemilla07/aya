import type { AiProviderConfig } from '../index.js';
import { type AiProvider, createProvider } from '../models.js';

export function customProvider(config: AiProviderConfig): AiProvider {
  if (config.provider !== 'custom') {
    throw new Error('Custom provider configuration must use provider "custom".');
  }
  return createProvider(config, 'Custom OpenAI-compatible provider');
}
