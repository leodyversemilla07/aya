import { randomUUID } from 'node:crypto';

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
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: AiToolCall[] }
  | { role: 'tool'; content: string; toolCallId: string };

export interface AiUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AiResponse {
  content: string;
  toolCalls: AiToolCall[];
  usage?: AiUsage;
  finishReason?: string;
  provider: ProviderId;
  model: string;
}

export interface AiRequestOptions {
  signal?: AbortSignal;
  tools?: AiTool[];
  maxTokens?: number;
  temperature?: number;
}

export interface AiProviderConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

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

const DEFAULTS: Record<ProviderId, { baseUrl: string; model: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'google/gemma-4-26b-a4b-it:free',
  },
  'opencode-zen': { baseUrl: 'https://opencode.ai/zen/v1', model: 'minimax-m2.5-free' },
  anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-3-5-haiku-latest' },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.0-flash',
  },
  custom: { baseUrl: 'http://localhost:3000/v1', model: 'default' },
};

function parseArguments(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function usageFrom(
  value:
    | {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        input_tokens?: number;
        output_tokens?: number;
      }
    | undefined,
): AiUsage | undefined {
  if (!value) return undefined;
  return {
    inputTokens: value.prompt_tokens ?? value.input_tokens,
    outputTokens: value.completion_tokens ?? value.output_tokens,
    totalTokens:
      value.total_tokens ??
      (value.input_tokens !== undefined && value.output_tokens !== undefined
        ? value.input_tokens + value.output_tokens
        : undefined),
  };
}

function abortError(signal: AbortSignal | undefined, timeoutMs: number): AiError {
  return new AiError(
    signal?.aborted
      ? 'The AI request was cancelled before it completed.'
      : `The AI request timed out after ${Math.round(timeoutMs / 1000)} seconds.`,
    504,
  );
}

const PROVIDER_KEY_ENV: Partial<Record<ProviderId, string>> = {
  openai: 'OPENAI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  'opencode-zen': 'OPENCODE_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GEMINI_API_KEY',
};

export function getProviderConfig(
  requestedProvider?: ProviderId,
  env: NodeJS.ProcessEnv = process.env,
): AiProviderConfig {
  const provider = (
    requestedProvider ??
    env.LLM_PROVIDER ??
    'opencode-zen'
  ).toLowerCase() as ProviderId;
  const defaults = DEFAULTS[provider];
  if (!defaults) throw new AiError(`Unknown AI provider "${provider}".`, 503);
  const apiKey = (
    env.LLM_API_KEY ??
    (PROVIDER_KEY_ENV[provider] && env[PROVIDER_KEY_ENV[provider]!])
  )?.trim();
  if (!apiKey) throw new AiError('LLM_API_KEY is not configured.', 503, provider);
  return {
    provider,
    apiKey,
    model: env.LLM_MODEL?.trim() || defaults.model,
    baseUrl: (env.LLM_BASE_URL?.trim() || defaults.baseUrl).replace(/\/+$/, ''),
    timeoutMs: Math.max(1_000, Number(env.LLM_TIMEOUT_MS ?? 60_000) || 60_000),
    maxRetries: Math.min(5, Math.max(0, Number(env.LLM_MAX_RETRIES ?? 2) || 0)),
  };
}

export class AiClient {
  private readonly config: Required<Pick<AiProviderConfig, 'baseUrl' | 'timeoutMs' | 'maxRetries'>>;

  constructor(private readonly providerConfig: AiProviderConfig) {
    this.config = {
      baseUrl:
        providerConfig.baseUrl?.replace(/\/+$/, '') || DEFAULTS[providerConfig.provider].baseUrl,
      timeoutMs: providerConfig.timeoutMs ?? 60_000,
      maxRetries: providerConfig.maxRetries ?? 2,
    };
  }

  async complete(messages: AiMessage[], options: AiRequestOptions = {}): Promise<AiResponse> {
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await this.request(messages, options);
      } catch (error) {
        if (!(error instanceof AiError) || !error.retryable || attempt >= this.config.maxRetries) {
          throw error;
        }
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 500 * 2 ** attempt);
          options.signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              reject(abortError(options.signal, this.config.timeoutMs));
            },
            { once: true },
          );
        });
      }
    }
    throw new AiError('The AI request failed after multiple attempts.', 502);
  }

  private async request(messages: AiMessage[], options: AiRequestOptions): Promise<AiResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const signal = options.signal
      ? AbortSignal.any([options.signal, controller.signal])
      : controller.signal;
    try {
      if (this.providerConfig.provider === 'anthropic')
        return await this.anthropic(messages, options, signal);
      if (this.providerConfig.provider === 'google')
        return await this.google(messages, options, signal);
      return await this.openAiCompatible(messages, options, signal);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchJson(
    url: string,
    init: RequestInit,
    signal: AbortSignal,
  ): Promise<Record<string, unknown>> {
    try {
      const response = await fetch(url, { ...init, signal });
      if (!response.ok) {
        await response.text();
        const retryable = response.status === 429 || response.status >= 500;
        throw new AiError(
          response.status === 401 || response.status === 403
            ? 'The AI provider rejected the configured API key.'
            : `The AI provider returned an error (${response.status}).`,
          response.status,
          this.providerConfig.provider,
          retryable,
        );
      }
      return (await response.json()) as Record<string, unknown>;
    } catch (error) {
      if (error instanceof AiError) throw error;
      if (signal.aborted) throw abortError(signal, this.config.timeoutMs);
      throw new AiError(
        `Could not reach the ${this.providerConfig.provider} AI provider.`,
        502,
        this.providerConfig.provider,
        true,
      );
    }
  }

  private async openAiCompatible(
    messages: AiMessage[],
    options: AiRequestOptions,
    signal: AbortSignal,
  ): Promise<AiResponse> {
    const body: Record<string, unknown> = {
      model: this.providerConfig.model,
      messages: messages.map((message) =>
        message.role === 'tool'
          ? { role: 'tool', content: message.content, tool_call_id: message.toolCallId }
          : {
              role: message.role,
              content: message.content,
              ...(message.role === 'assistant' && message.toolCalls
                ? {
                    tool_calls: message.toolCalls.map((call) => ({
                      id: call.id,
                      type: 'function',
                      function: { name: call.name, arguments: JSON.stringify(call.arguments) },
                    })),
                  }
                : {}),
            },
      ),
      max_tokens: options.maxTokens ?? 4096,
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.tools?.length) {
      body.tools = options.tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description ?? '',
          parameters: tool.parameters,
        },
      }));
      body.tool_choice = 'auto';
    }
    const headers = {
      'content-type': 'application/json',
      authorization: `Bearer ${this.providerConfig.apiKey}`,
      ...this.providerConfig.headers,
    };
    const data = await this.fetchJson(
      `${this.config.baseUrl.replace(/\/chat\/completions$/i, '')}/chat/completions`,
      { method: 'POST', headers, body: JSON.stringify(body) },
      signal,
    );
    const choices = data.choices as
      | Array<{
          message?: {
            content?: string | null;
            tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: unknown } }>;
          };
          finish_reason?: string;
        }>
      | undefined;
    const choice = choices?.[0];
    if (!choice?.message)
      throw new AiError(
        'The AI provider returned an empty response.',
        502,
        this.providerConfig.provider,
      );
    return {
      content: choice.message.content ?? '',
      toolCalls: (choice.message.tool_calls ?? [])
        .filter((call) => call.function?.name)
        .map((call, index) => ({
          id: call.id ?? `call_${randomUUID()}_${index}`,
          name: call.function?.name as string,
          arguments: parseArguments(call.function?.arguments),
        })),
      usage: usageFrom(
        data.usage as
          | {
              prompt_tokens?: number;
              completion_tokens?: number;
              total_tokens?: number;
              input_tokens?: number;
              output_tokens?: number;
            }
          | undefined,
      ),
      finishReason: choice.finish_reason,
      provider: this.providerConfig.provider,
      model: this.providerConfig.model,
    };
  }

  private async anthropic(
    messages: AiMessage[],
    options: AiRequestOptions,
    signal: AbortSignal,
  ): Promise<AiResponse> {
    const system = messages.find((message) => message.role === 'system')?.content;
    const body = {
      model: this.providerConfig.model,
      max_tokens: options.maxTokens ?? 4096,
      ...(system ? { system } : {}),
      messages: messages
        .filter((message) => message.role !== 'system')
        .map((message) => ({
          role: message.role === 'tool' ? 'user' : message.role,
          content:
            message.role === 'tool'
              ? [{ type: 'tool_result', tool_use_id: message.toolCallId, content: message.content }]
              : message.content,
        })),
      ...(options.tools?.length
        ? {
            tools: options.tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              input_schema: tool.parameters,
            })),
          }
        : {}),
    };
    const data = await this.fetchJson(
      `${this.config.baseUrl}/v1/messages`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.providerConfig.apiKey,
          'anthropic-version': '2023-06-01',
          ...this.providerConfig.headers,
        },
        body: JSON.stringify(body),
      },
      signal,
    );
    const content = data.content as
      | Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>
      | undefined;
    return {
      content:
        content
          ?.filter((part) => part.type === 'text')
          .map((part) => part.text ?? '')
          .join('') ?? '',
      toolCalls:
        content
          ?.filter((part) => part.type === 'tool_use' && part.name)
          .map((part) => ({
            id: part.id ?? randomUUID(),
            name: part.name as string,
            arguments: parseArguments(part.input),
          })) ?? [],
      usage: usageFrom(
        data.usage as
          | {
              input_tokens?: number;
              output_tokens?: number;
              total_tokens?: number;
            }
          | undefined,
      ),
      provider: this.providerConfig.provider,
      model: this.providerConfig.model,
      finishReason: typeof data.stop_reason === 'string' ? data.stop_reason : undefined,
    };
  }

  private async google(
    messages: AiMessage[],
    options: AiRequestOptions,
    signal: AbortSignal,
  ): Promise<AiResponse> {
    const contents = messages
      .filter((message) => message.role !== 'system')
      .map((message) => {
        if (message.role === 'tool') {
          return {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: message.toolCallId,
                  response: parseArguments(message.content),
                },
              },
            ],
          };
        }
        return {
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [
            ...(message.content ? [{ text: message.content }] : []),
            ...(message.role === 'assistant' && message.toolCalls
              ? message.toolCalls.map((call) => ({
                  functionCall: { name: call.name, args: call.arguments },
                }))
              : []),
          ],
        };
      });
    const system = messages.find((message) => message.role === 'system')?.content;
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: options.maxTokens ?? 4096,
        ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
      },
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      ...(options.tools?.length
        ? {
            tools: [
              {
                functionDeclarations: options.tools.map((tool) => ({
                  name: tool.name,
                  description: tool.description,
                  parameters: tool.parameters,
                })),
              },
            ],
          }
        : {}),
    };
    const data = await this.fetchJson(
      `${this.config.baseUrl}/models/${this.providerConfig.model}:generateContent?key=${encodeURIComponent(this.providerConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...this.providerConfig.headers },
        body: JSON.stringify(body),
      },
      signal,
    );
    const parts =
      (
        data.candidates as
          | Array<{
              content?: {
                parts?: Array<{ text?: string; functionCall?: { name?: string; args?: unknown } }>;
              };
            }>
          | undefined
      )?.[0]?.content?.parts ?? [];
    return {
      content: parts.map((part) => part.text ?? '').join(''),
      toolCalls: parts
        .filter((part) => part.functionCall?.name)
        .map((part) => ({
          id: randomUUID(),
          name: part.functionCall?.name as string,
          arguments: parseArguments(part.functionCall?.args),
        })),
      provider: this.providerConfig.provider,
      model: this.providerConfig.model,
    };
  }
}

export function createAiClient(config = getProviderConfig()): AiClient {
  return new AiClient(config);
}

export * from './models.js';
