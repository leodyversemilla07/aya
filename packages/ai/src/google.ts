import { randomUUID } from 'node:crypto';
import { AiError } from './errors.js';
import { assertProviderOk } from './http.js';
import { parseArguments, toolNameFor, toolResponsePayload, usageFrom } from './parse.js';
import { readSseEvents } from './sse.js';
import type {
  AiDeltaHandler,
  AiMessage,
  AiProviderConfig,
  AiRequestOptions,
  AiResponse,
  AiToolCall,
} from './types.js';

interface GeminiPart {
  text?: string;
  functionCall?: { name?: string; args?: unknown };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export function googleUrl(baseUrl: string, model: string, apiKey: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '').replace(/\/models$/, '');
  return `${trimmed}/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
}

export function googleSystemPrompt(messages: AiMessage[]): string | undefined {
  const system = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .filter((content) => content.trim().length > 0)
    .join('\n\n');
  return system || undefined;
}

/**
 * Gemini identifies a tool result by function name, so the name is resolved
 * from the assistant turn that requested the call. Consecutive user turns
 * are merged because Gemini expects a strictly alternating conversation.
 */
export function googleContents(messages: AiMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];
  const push = (role: GeminiContent['role'], parts: GeminiPart[]) => {
    const previous = contents[contents.length - 1];
    if (previous && previous.role === role) {
      previous.parts.push(...parts);
      return;
    }
    contents.push({ role, parts });
  };

  for (const message of messages) {
    if (message.role === 'system') continue;
    if (message.role === 'user') {
      push('user', [{ text: message.content }]);
      continue;
    }
    if (message.role === 'assistant') {
      const parts: GeminiPart[] = [];
      if (message.content.trim().length > 0) parts.push({ text: message.content });
      for (const call of message.toolCalls ?? []) {
        parts.push({ functionCall: { name: call.name, args: call.arguments } });
      }
      // A silent completion carries no information, so the turn is dropped
      // rather than sent as an empty model turn.
      if (parts.length > 0) push('model', parts);
      continue;
    }
    const name =
      message.toolName ?? toolNameFor(messages, message.toolCallId) ?? message.toolCallId;
    push('user', [
      {
        functionResponse: {
          name,
          response: toolResponsePayload(message.content),
        },
      },
    ]);
  }

  return contents;
}

export function buildGoogleBody(
  config: AiProviderConfig,
  messages: AiMessage[],
  options: AiRequestOptions,
): Record<string, unknown> {
  const system = googleSystemPrompt(messages);
  return {
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
}

export async function streamGoogle(
  config: AiProviderConfig,
  messages: AiMessage[],
  options: AiRequestOptions,
  signal: AbortSignal,
  onDelta: AiDeltaHandler,
): Promise<AiResponse> {
  const body = buildGoogleBody(config, messages, options);
  const response = await fetch(
    googleUrl(
      config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta',
      config.model,
      config.apiKey,
    ),
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
        ...config.headers,
      },
      body: JSON.stringify(body),
      signal,
    },
  );
  await assertProviderOk(response, config.provider);
  if (!response.body) {
    throw new AiError('The AI provider returned an empty response.', 502, config.provider, true);
  }

  let content = '';
  let finishReason: string | undefined;
  let usage: AiResponse['usage'];
  let sawCandidate = false;
  const toolCalls: AiToolCall[] = [];

  for await (const data of readSseEvents(response.body)) {
    let chunk: Record<string, unknown>;
    try {
      chunk = JSON.parse(data) as Record<string, unknown>;
    } catch {
      continue;
    }

    const error = chunk.error as { message?: string } | undefined;
    if (error) {
      throw new AiError(
        error.message ?? 'The AI provider reported a streaming error.',
        502,
        config.provider,
        true,
      );
    }

    const feedback = chunk.promptFeedback as { blockReason?: string } | undefined;
    if (feedback?.blockReason) {
      throw new AiError('The AI provider declined to answer this request.', 422, config.provider);
    }

    const candidate = (
      chunk.candidates as
        | Array<{
            content?: { parts?: GeminiPart[] };
            finishReason?: string;
          }>
        | undefined
    )?.[0];
    if (!candidate) continue;
    sawCandidate = true;

    for (const part of candidate.content?.parts ?? []) {
      if (typeof part.text === 'string' && part.text.length > 0) {
        content += part.text;
        onDelta(part.text);
      }
      if (part.functionCall?.name) {
        toolCalls.push({
          id: `call_${randomUUID()}`,
          name: part.functionCall.name,
          arguments: parseArguments(part.functionCall.args),
        });
      }
    }

    if (candidate.finishReason) finishReason = candidate.finishReason;
    usage =
      usageFrom(
        chunk.usageMetadata as
          | {
              promptTokenCount?: number;
              candidatesTokenCount?: number;
              totalTokenCount?: number;
            }
          | undefined,
      ) ?? usage;
  }

  if (!sawCandidate && content.length === 0 && toolCalls.length === 0) {
    throw new AiError('The AI provider returned an empty response.', 502, config.provider);
  }

  return {
    content,
    toolCalls,
    usage,
    finishReason,
    provider: config.provider,
    model: config.model,
    streamMode: 'native',
  };
}
