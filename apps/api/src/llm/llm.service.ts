import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Injectable, Logger } from '@nestjs/common';
import { type ZodTypeAny, toJSONSchema } from 'zod';

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

export interface LlmToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: LlmToolCall[];
}

export interface LlmResponse {
  content: string;
  toolCalls: LlmToolCall[];
}

export interface LlmToolDefinition {
  description?: string;
  parameters: ZodTypeAny;
}

export type LlmTools = Record<string, LlmToolDefinition>;

interface ProviderConfig {
  baseURL: string;
  model: string;
  apiKey: string;
}

interface ProviderDefaults {
  baseURL: string;
  model: string;
}

const PROVIDER_DEFAULTS: Record<string, ProviderDefaults> = {
  openai: { baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1',
    model: 'google/gemma-4-26b-a4b-it:free',
  },
  'opencode-zen': { baseURL: 'https://opencode.ai/zen/v1', model: 'minimax-m2.5-free' },
};

const REQUEST_TIMEOUT_MS = Math.max(1_000, Number(process.env.LLM_TIMEOUT_MS ?? 60_000) || 60_000);
const MAX_RETRIES = Math.min(5, Math.max(0, Number(process.env.LLM_MAX_RETRIES ?? 2) || 0));
const MAX_TOOL_CALLS = 8;
const MAX_TOKENS = (() => {
  const configured = Number(process.env.LLM_MAX_TOKENS ?? 4096);
  return Number.isInteger(configured) && configured > 0 ? configured : 4096;
})();

function getProviderConfig(): ProviderConfig {
  const provider = (process.env.LLM_PROVIDER ?? 'opencode-zen').toLowerCase();
  const defaults = PROVIDER_DEFAULTS[provider];
  if (!defaults) {
    throw new LlmError(
      `Unknown LLM_PROVIDER "${provider}". Use openai, openrouter, or opencode-zen.`,
      503,
    );
  }

  const apiKey = process.env.LLM_API_KEY?.trim();

  if (!apiKey) {
    throw new LlmError(
      'LLM_API_KEY is not configured. Add it to apps/api/.env before using the assistant.',
      503,
    );
  }

  const baseURL = (process.env.LLM_BASE_URL?.trim() || defaults.baseURL)
    .replace(/\/+$/, '')
    .replace(/\/chat\/completions$/i, '');

  return {
    baseURL,
    model: process.env.LLM_MODEL?.trim() || defaults.model,
    apiKey,
  };
}

export function toJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  const { $schema: _schemaMetadata, ...jsonSchema } = toJSONSchema(schema, {
    target: 'draft-7',
    io: 'input',
  });
  return jsonSchema;
}

function parseToolArguments(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }

  if (typeof raw !== 'string' || raw.trim() === '') {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Invalid JSON from the model is treated as empty arguments. The tool
    // schema will return a helpful validation error to the model.
  }

  return {};
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

function providerErrorMessage(status: number): string {
  if (status === 401 || status === 403) {
    return 'The LLM provider rejected the configured API key. Check LLM_API_KEY.';
  }
  if (status === 404) {
    return 'The configured LLM model was not found. Check LLM_MODEL and LLM_BASE_URL.';
  }
  if (status === 429) {
    return 'The LLM provider rate limit was reached. Please try again in a moment.';
  }
  if (status === 400) {
    return 'The LLM provider rejected the request. Check LLM_MODEL and LLM_BASE_URL.';
  }
  return `The LLM provider returned an error (${status}). Please try again later.`;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  async chat(messages: LlmMessage[], tools?: LlmTools, signal?: AbortSignal): Promise<LlmResponse> {
    const config = getProviderConfig();
    const body = this.buildRequestBody(config, messages, tools);
    const data = await this.requestCompletion(config, body, signal);

    const choice = data.choices?.[0];
    if (!choice?.message) {
      throw new LlmError('The LLM provider returned an empty response.', 502);
    }

    const rawToolCalls = choice.message.tool_calls ?? [];
    if (rawToolCalls.length > MAX_TOOL_CALLS) {
      this.logger.warn(
        `LLM response contained ${rawToolCalls.length} tool calls; executing at most ${MAX_TOOL_CALLS}.`,
      );
    }
    const toolCalls: LlmToolCall[] = rawToolCalls
      .filter((toolCall) => typeof toolCall.function?.name === 'string')
      .slice(0, MAX_TOOL_CALLS)
      .map((toolCall, index) => ({
        id: toolCall.id ?? `call_${randomUUID()}_${index}`,
        name: toolCall.function?.name as string,
        args: parseToolArguments(toolCall.function?.arguments),
      }));

    return {
      content: typeof choice.message.content === 'string' ? choice.message.content : '',
      toolCalls,
    };
  }

  private buildRequestBody(
    config: ProviderConfig,
    messages: LlmMessage[],
    tools?: LlmTools,
  ): Record<string, unknown> {
    const apiMessages = messages.flatMap((message) => {
      if (message.role === 'tool') {
        if (!message.toolCallId) return [];
        return [
          {
            role: 'tool' as const,
            content: message.content,
            tool_call_id: message.toolCallId,
          },
        ];
      }

      const apiMessage: Record<string, unknown> = {
        role: message.role,
        content: message.content,
      };

      if (message.role === 'assistant' && message.toolCalls?.length) {
        apiMessage.tool_calls = message.toolCalls.map((toolCall) => ({
          id: toolCall.id,
          type: 'function',
          function: {
            name: toolCall.name,
            arguments: JSON.stringify(toolCall.args ?? {}),
          },
        }));
      }

      return [apiMessage];
    });

    const body: Record<string, unknown> = {
      model: config.model,
      messages: apiMessages,
      max_tokens: MAX_TOKENS,
    };

    if (tools && Object.keys(tools).length > 0) {
      body.tools = Object.entries(tools).map(([name, tool]) => ({
        type: 'function',
        function: {
          name,
          description: tool.description ?? '',
          parameters: toJsonSchema(tool.parameters),
        },
      }));
      body.tool_choice = 'auto';
    }

    return body;
  }

  private async requestCompletion(
    config: ProviderConfig,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<{
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{
          id?: string;
          function?: { name?: string; arguments?: string };
        }>;
      };
    }>;
  }> {
    const url = `${config.baseURL}/chat/completions`;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const timeoutController = new AbortController();
      const timeout = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);
      const requestSignal = signal
        ? AbortSignal.any([signal, timeoutController.signal])
        : timeoutController.signal;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: requestSignal,
        });

        if (response.ok) {
          try {
            return await response.json();
          } catch {
            throw new LlmError('The LLM provider returned an invalid JSON response.', 502);
          }
        }

        const rawError = await response.text().catch(() => '');
        this.logger.warn(`LLM request failed with ${response.status}: ${rawError.slice(0, 500)}`);

        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < MAX_RETRIES) {
          await delay(500 * 2 ** attempt, undefined, { signal });
          continue;
        }

        throw new LlmError(
          providerErrorMessage(response.status),
          response.status === 429 ? 429 : 502,
        );
      } catch (error) {
        if (error instanceof LlmError) throw error;

        if (isAbortError(error)) {
          throw new LlmError(
            signal?.aborted
              ? 'The LLM request was cancelled before it completed.'
              : `The LLM request timed out after ${Math.round(REQUEST_TIMEOUT_MS / 1000)} seconds.`,
            504,
          );
        }

        this.logger.warn(
          `Could not reach LLM provider at ${config.baseURL}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );

        if (attempt < MAX_RETRIES) {
          await delay(500 * 2 ** attempt, undefined, { signal });
          continue;
        }

        throw new LlmError(
          `Could not reach the LLM provider at ${config.baseURL}. Check LLM_BASE_URL and network access.`,
          502,
        );
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new LlmError('The LLM request failed after multiple attempts.', 502);
  }
}
