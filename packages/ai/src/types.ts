export type ProviderId =
  | 'openai'
  | 'openrouter'
  | 'opencode-zen'
  | 'anthropic'
  | 'google'
  | 'custom';

export interface AiTool {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

export interface AiToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type AiMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: AiToolCall[] }
  | { role: 'tool'; content: string; toolCallId: string; toolName?: string };

export interface AiUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

/**
 * `native` means the provider streamed incremental deltas over the wire.
 * `buffered` means the response was fetched in one shot and replayed as a
 * single delta because the provider did not expose a streaming endpoint.
 */
export type AiStreamMode = 'native' | 'buffered';

export interface AiResponse {
  content: string;
  toolCalls: AiToolCall[];
  usage?: AiUsage;
  finishReason?: string;
  provider: ProviderId;
  model: string;
  streamMode?: AiStreamMode;
}

export interface AiRequestOptions {
  signal?: AbortSignal;
  tools?: AiTool[];
  maxTokens?: number;
  temperature?: number;
}

export type AiDeltaHandler = (delta: string) => void;

export interface AiProviderConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}
