import { randomUUID } from 'node:crypto';
import { anthropicUrl, buildAnthropicBody, streamAnthropic } from './anthropic.js';
import { AiError, abortError, timeoutError } from './errors.js';
import { googleContents, googleSystemPrompt, streamGoogle } from './google.js';
import { assertProviderOk } from './http.js';
import { parseArguments, usageFrom } from './parse.js';
import { readSseEvents } from './sse.js';
import type {
  AiDeltaHandler,
  AiMessage,
  AiProviderConfig,
  AiRequestOptions,
  AiResponse,
  AiToolCall,
  ProviderId,
} from './types.js';

export * from './types.js';
export { AiError } from './errors.js';

const DEFAULTS: Record<ProviderId, { baseUrl: string; model: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'google/gemma-4-26b-a4b-it:free',
  },
  'opencode-zen': { baseUrl: 'https://opencode.ai/zen/v1', model: 'minimax-m2.5-free' },
  anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-5' },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.5-flash',
  },
  custom: { baseUrl: 'http://localhost:3000/v1', model: 'default' },
};

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

  private resolvedConfig(): AiProviderConfig {
    return {
      ...this.providerConfig,
      baseUrl: this.config.baseUrl,
      timeoutMs: this.config.timeoutMs,
      maxRetries: this.config.maxRetries,
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
        await this.retryDelay(attempt, options.signal);
      }
    }
    throw new AiError('The AI request failed after multiple attempts.', 502);
  }

  async stream(
    messages: AiMessage[],
    options: AiRequestOptions = {},
    onDelta: AiDeltaHandler = () => {},
  ): Promise<AiResponse> {
    let emitted = false;
    const emit = (delta: string) => {
      if (!delta) return;
      emitted = true;
      onDelta(delta);
    };

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await this.requestStream(messages, options, emit);
      } catch (error) {
        // Retrying after tokens reached the caller would duplicate output.
        if (
          emitted ||
          !(error instanceof AiError) ||
          !error.retryable ||
          attempt >= this.config.maxRetries
        ) {
          throw error;
        }
        await this.retryDelay(attempt, options.signal);
      }
    }
    throw new AiError('The AI request failed after multiple attempts.', 502);
  }

  private async retryDelay(attempt: number, signal?: AbortSignal): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 500 * 2 ** attempt);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(abortError(signal, this.config.timeoutMs));
        },
        { once: true },
      );
    });
  }

  private async requestStream(
    messages: AiMessage[],
    options: AiRequestOptions,
    onDelta: AiDeltaHandler,
  ): Promise<AiResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const signal = options.signal
      ? AbortSignal.any([options.signal, controller.signal])
      : controller.signal;

    try {
      if (this.providerConfig.provider === 'anthropic') {
        return await streamAnthropic(this.resolvedConfig(), messages, options, signal, onDelta);
      }
      if (this.providerConfig.provider === 'google') {
        return await streamGoogle(this.resolvedConfig(), messages, options, signal, onDelta);
      }
      return await this.openAiCompatibleStream(messages, options, signal, onDelta);
    } catch (error) {
      if (error instanceof AiError) {
        if (controller.signal.aborted && error.status === 504) {
          throw timeoutError(this.config.timeoutMs);
        }
        throw error;
      }
      if (controller.signal.aborted) throw timeoutError(this.config.timeoutMs);
      if (signal.aborted) throw abortError(signal, this.config.timeoutMs);
      throw new AiError(
        `Could not reach the ${this.providerConfig.provider} AI provider.`,
        502,
        this.providerConfig.provider,
        true,
      );
    } finally {
      clearTimeout(timeout);
    }
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
    } catch (error) {
      if (error instanceof AiError) {
        if (controller.signal.aborted && error.status === 504) {
          throw timeoutError(this.config.timeoutMs);
        }
        throw error;
      }
      if (controller.signal.aborted) throw timeoutError(this.config.timeoutMs);
      if (signal.aborted) throw abortError(signal, this.config.timeoutMs);
      throw new AiError(
        `Could not reach the ${this.providerConfig.provider} AI provider.`,
        502,
        this.providerConfig.provider,
        true,
      );
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
      await assertProviderOk(response, this.providerConfig.provider);
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

  private chatCompletionsUrl(): string {
    return `${this.config.baseUrl.replace(/\/chat\/completions$/i, '')}/chat/completions`;
  }

  private openAiBody(messages: AiMessage[], options: AiRequestOptions): Record<string, unknown> {
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
    return body;
  }

  private async openAiCompatible(
    messages: AiMessage[],
    options: AiRequestOptions,
    signal: AbortSignal,
  ): Promise<AiResponse> {
    const body = this.openAiBody(messages, options);
    const headers = {
      'content-type': 'application/json',
      authorization: `Bearer ${this.providerConfig.apiKey}`,
      ...this.providerConfig.headers,
    };
    const data = await this.fetchJson(
      this.chatCompletionsUrl(),
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

  private async openAiCompatibleStream(
    messages: AiMessage[],
    options: AiRequestOptions,
    signal: AbortSignal,
    onDelta: AiDeltaHandler,
  ): Promise<AiResponse> {
    const headers = {
      'content-type': 'application/json',
      accept: 'text/event-stream',
      authorization: `Bearer ${this.providerConfig.apiKey}`,
      ...this.providerConfig.headers,
    };

    let response: Response;
    try {
      response = await fetch(this.chatCompletionsUrl(), {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...this.openAiBody(messages, options), stream: true }),
        signal,
      });
      await assertProviderOk(response, this.providerConfig.provider);
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
    if (!response.body) {
      throw new AiError(
        'The AI provider returned an empty response.',
        502,
        this.providerConfig.provider,
        true,
      );
    }

    let content = '';
    let sawChoice = false;
    let finishReason: string | undefined;
    let usage: AiResponse['usage'];
    const toolCalls: Array<{ id?: string; name?: string; arguments: string } | undefined> = [];

    try {
      for await (const data of readSseEvents(response.body)) {
        if (data === '[DONE]') break;
        let chunk: Record<string, unknown>;
        try {
          chunk = JSON.parse(data) as Record<string, unknown>;
        } catch {
          continue;
        }

        if (chunk.usage) {
          usage = usageFrom(
            chunk.usage as {
              prompt_tokens?: number;
              completion_tokens?: number;
              total_tokens?: number;
            },
          );
        }

        const choice = (
          chunk.choices as
            | Array<{
                delta?: {
                  content?: string | null;
                  tool_calls?: Array<{
                    index?: number;
                    id?: string;
                    function?: { name?: string; arguments?: string };
                  }>;
                };
                finish_reason?: string | null;
              }>
            | undefined
        )?.[0];
        if (!choice) continue;
        sawChoice = true;

        const text = typeof choice.delta?.content === 'string' ? choice.delta.content : '';
        if (text) {
          content += text;
          onDelta(text);
        }

        (choice.delta?.tool_calls ?? []).forEach((call, fallbackIndex) => {
          if (!call) return;
          const index = typeof call.index === 'number' ? call.index : fallbackIndex;
          let entry = toolCalls[index];
          if (!entry) {
            entry = { arguments: '' };
            toolCalls[index] = entry;
          }
          if (call.id) entry.id = call.id;
          if (call.function?.name) entry.name = (entry.name ?? '') + call.function.name;
          if (typeof call.function?.arguments === 'string') {
            entry.arguments += call.function.arguments;
          }
        });

        if (choice.finish_reason) finishReason = choice.finish_reason;
      }
    } catch (error) {
      if (error instanceof AiError) throw error;
      if (signal.aborted) throw abortError(signal, this.config.timeoutMs);
      throw new AiError(
        'The AI provider stream ended unexpectedly.',
        502,
        this.providerConfig.provider,
        true,
      );
    }

    if (!sawChoice) {
      throw new AiError(
        'The AI provider returned an empty response.',
        502,
        this.providerConfig.provider,
      );
    }

    const completedToolCalls: AiToolCall[] = [];
    toolCalls.forEach((call, index) => {
      if (!call?.name) return;
      completedToolCalls.push({
        id: call.id ?? `call_${randomUUID()}_${index}`,
        name: call.name,
        arguments: parseArguments(call.arguments),
      });
    });

    return {
      content,
      toolCalls: completedToolCalls,
      usage,
      finishReason,
      provider: this.providerConfig.provider,
      model: this.providerConfig.model,
      streamMode: 'native',
    };
  }

  private async anthropic(
    messages: AiMessage[],
    options: AiRequestOptions,
    signal: AbortSignal,
  ): Promise<AiResponse> {
    const body = buildAnthropicBody(this.resolvedConfig(), messages, options);
    const data = await this.fetchJson(
      anthropicUrl(this.config.baseUrl),
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
    const system = googleSystemPrompt(messages);
    const body: Record<string, unknown> = {
      contents: googleContents(messages),
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
                  description: tool.description ?? '',
                  parameters: tool.parameters,
                })),
              },
            ],
          }
        : {}),
    };
    const data = await this.fetchJson(
      `${this.config.baseUrl.replace(/\/+$/, '')}/models/${this.providerConfig.model}:generateContent?key=${encodeURIComponent(this.providerConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...this.providerConfig.headers },
        body: JSON.stringify(body),
      },
      signal,
    );
    const candidate = (
      data.candidates as
        | Array<{
            content?: {
              parts?: Array<{ text?: string; functionCall?: { name?: string; args?: unknown } }>;
            };
            finishReason?: string;
          }>
        | undefined
    )?.[0];
    const parts = candidate?.content?.parts ?? [];
    return {
      content: parts.map((part) => part.text ?? '').join(''),
      toolCalls: parts
        .filter((part) => part.functionCall?.name)
        .map((part) => ({
          id: randomUUID(),
          name: part.functionCall?.name as string,
          arguments: parseArguments(part.functionCall?.args),
        })),
      usage: usageFrom(
        data.usage as
          | {
              prompt_tokens?: number;
              completion_tokens?: number;
              total_tokens?: number;
              input_tokens?: number;
              output_tokens?: number;
              promptTokenCount?: number;
              candidatesTokenCount?: number;
              totalTokenCount?: number;
            }
          | undefined,
      ),
      provider: this.providerConfig.provider,
      model: this.providerConfig.model,
      finishReason: candidate?.finishReason,
    };
  }
}

export function createAiClient(config = getProviderConfig()): AiClient {
  return new AiClient(config);
}

export * from './models.js';
