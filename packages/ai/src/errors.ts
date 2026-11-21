import type { ProviderId } from './types.js';

export class AiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly provider?: ProviderId,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

export function abortError(signal: AbortSignal | undefined, timeoutMs: number): AiError {
  return new AiError(
    signal?.aborted
      ? 'The AI request was cancelled before it completed.'
      : `The AI request timed out after ${Math.round(timeoutMs / 1000)} seconds.`,
    504,
  );
}

export function timeoutError(timeoutMs: number): AiError {
  return new AiError(
    `The AI request timed out after ${Math.round(timeoutMs / 1000)} seconds.`,
    504,
  );
}
