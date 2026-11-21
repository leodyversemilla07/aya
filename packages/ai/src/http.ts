import { AiError } from './errors.js';
import type { ProviderId } from './types.js';

export async function assertProviderOk(response: Response, provider: ProviderId): Promise<void> {
  if (response.ok) return;
  await response.text();
  const retryable = response.status === 429 || response.status >= 500;
  throw new AiError(
    response.status === 401 || response.status === 403
      ? 'The AI provider rejected the configured API key.'
      : `The AI provider returned an error (${response.status}).`,
    response.status,
    provider,
    retryable,
  );
}
