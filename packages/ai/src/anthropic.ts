import { randomUUID } from 'node:crypto';
import { AiError } from './errors.js';
import { assertProviderOk } from './http.js';
import { parseArguments } from './parse.js';
import { readSseEvents } from './sse.js';
import type {
  AiDeltaHandler,
  AiMessage,
  AiProviderConfig,
  AiRequestOptions,
  AiResponse,
  AiToolCall,
  AiUsage,
} from './types.js';

interface AnthropicBlock {
  type: string;
  text?: string;
  content?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
}

interface AnthropicTurn {
  role: 'user' | 'assistant';
  content: AnthropicBlock[];
}

export function anthropicUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return trimmed.endsWith('/v1') ? `${trimmed}/messages` : `${trimmed}/v1/messages`;
}

export function anthropicSystemPrompt(messages: AiMessage[]): string | undefined {
  const system = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .filter((content) => content.trim().length > 0)
    .join('\n\n');
  return system || undefined;
}

/**
 * Anthropic requires strict user/assistant alternation and expects every
 * `tool_result` block to sit in the user turn that follows the assistant
 * turn containing the matching `tool_use` block. Consecutive turns are
 * therefore merged instead of being sent as separate messages.
 */
export function anthropicTurns(messages: AiMessage[]): AnthropicTurn[] {
  const turns: AnthropicTurn[] = [];
  const push = (role: AnthropicTurn['role'], blocks: AnthropicBlock[]) => {
    const previous = turns[turns.length - 1];
    if (previous && previous.role === role) {
      previous.content.push(...blocks);
      return;
    }
    turns.push({ role, content: blocks });
  };

  for (const message of messages) {
    if (message.role === 'system') continue;
    if (message.role === 'user') {
      push('user', [{ type: 'text', text: message.content }]);
      continue;
    }
    if (message.role === 'assistant') {
      const content: AnthropicBlock[] = [];
      if (message.content.trim().length > 0) content.push({ type: 'text', text: message.content });
      for (const call of message.toolCalls ?? []) {
        content.push({ type: 'tool_use', id: call.id, name: call.name, input: call.arguments });
      }
      // Anthropic rejects empty assistant turns, so a silent completion is
      // dropped instead of being sent as an empty text block.
      if (content.length > 0) push('assistant', content);
      continue;
    }
    push('user', [
      {
        type: 'tool_result',
        tool_use_id: message.toolCallId,
        content: message.content,
      },
    ]);
  }

  return turns;
}

export function buildAnthropicBody(
  config: AiProviderConfig,
  messages: AiMessage[],
  options: AiRequestOptions,
): Record<string, unknown> {
  const system = anthropicSystemPrompt(messages);
  return {
    model: config.model,
    max_tokens: options.maxTokens ?? 4096,
    ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
    ...(system ? { system } : {}),
    messages: anthropicTurns(messages),
    ...(options.tools?.length
      ? {
          tools: options.tools.map((tool) => ({
            name: tool.name,
            description: tool.description ?? '',
            input_schema: tool.parameters,
          })),
        }
      : {}),
  };
}

interface AnthropicStreamBlock {
  type: string;
  id?: string;
  name?: string;
  json: string;
  input?: unknown;
}

export async function streamAnthropic(
  config: AiProviderConfig,
  messages: AiMessage[],
  options: AiRequestOptions,
  signal: AbortSignal,
  onDelta: AiDeltaHandler,
): Promise<AiResponse> {
  const body = { ...buildAnthropicBody(config, messages, options), stream: true };
  const response = await fetch(anthropicUrl(config.baseUrl ?? 'https://api.anthropic.com'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'text/event-stream',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      ...config.headers,
    },
    body: JSON.stringify(body),
    signal,
  });
  await assertProviderOk(response, config.provider);
  if (!response.body) {
    throw new AiError('The AI provider returned an empty response.', 502, config.provider, true);
  }

  let content = '';
  let usage: AiUsage | undefined;
  let finishReason: string | undefined;
  let sawEvent = false;
  let sawStop = false;
  const blocks = new Map<number, AnthropicStreamBlock>();

  for await (const data of readSseEvents(response.body)) {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(data) as Record<string, unknown>;
    } catch {
      continue;
    }

    const type = typeof event.type === 'string' ? event.type : '';
    switch (type) {
      case 'message_start': {
        sawEvent = true;
        const message = event.message as
          | { usage?: { input_tokens?: number; output_tokens?: number } }
          | undefined;
        const inputTokens = message?.usage?.input_tokens;
        const outputTokens = message?.usage?.output_tokens;
        usage = {
          inputTokens,
          outputTokens,
          totalTokens:
            inputTokens !== undefined && outputTokens !== undefined
              ? inputTokens + outputTokens
              : undefined,
        };
        break;
      }
      case 'content_block_start': {
        sawEvent = true;
        const index = typeof event.index === 'number' ? event.index : blocks.size;
        const block = event.content_block as AnthropicBlock | undefined;
        blocks.set(index, {
          type: block?.type ?? 'text',
          id: block?.id,
          name: block?.name,
          json: '',
          input: block?.input,
        });
        if (block?.type === 'text' && typeof block.text === 'string' && block.text.length > 0) {
          content += block.text;
          onDelta(block.text);
        }
        break;
      }
      case 'content_block_delta': {
        sawEvent = true;
        const index = typeof event.index === 'number' ? event.index : 0;
        const delta = event.delta as
          | { type?: string; text?: string; partial_json?: string }
          | undefined;
        if (
          delta?.type === 'text_delta' &&
          typeof delta.text === 'string' &&
          delta.text.length > 0
        ) {
          content += delta.text;
          onDelta(delta.text);
          break;
        }
        if (delta?.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
          const block = blocks.get(index);
          if (block) block.json += delta.partial_json;
        }
        break;
      }
      case 'content_block_stop': {
        sawEvent = true;
        break;
      }
      case 'message_delta': {
        sawEvent = true;
        const delta = event.delta as { stop_reason?: string } | undefined;
        if (delta?.stop_reason) finishReason = delta.stop_reason;
        const eventUsage = event.usage as
          | { input_tokens?: number; output_tokens?: number }
          | undefined;
        if (eventUsage?.output_tokens !== undefined) {
          const inputTokens = eventUsage.input_tokens ?? usage?.inputTokens;
          usage = {
            inputTokens,
            outputTokens: eventUsage.output_tokens,
            totalTokens:
              inputTokens !== undefined ? inputTokens + eventUsage.output_tokens : undefined,
          };
        }
        break;
      }
      case 'message_stop': {
        sawEvent = true;
        sawStop = true;
        break;
      }
      case 'error': {
        const error = event.error as { message?: string } | undefined;
        throw new AiError(
          error?.message ?? 'The AI provider reported a streaming error.',
          502,
          config.provider,
          true,
        );
      }
      default:
        break;
    }
  }

  if (!sawEvent) {
    throw new AiError('The AI provider returned an empty response.', 502, config.provider);
  }
  if (!sawStop) {
    throw new AiError('The AI provider stream ended unexpectedly.', 502, config.provider, true);
  }

  const toolCalls: AiToolCall[] = [];
  for (const block of blocks.values()) {
    if (block.type !== 'tool_use' || !block.name) continue;
    const args = block.json
      ? parseArguments(block.json)
      : block.input && typeof block.input === 'object' && !Array.isArray(block.input)
        ? (block.input as Record<string, unknown>)
        : {};
    toolCalls.push({
      id: block.id ?? `call_${randomUUID()}`,
      name: block.name,
      arguments: args,
    });
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
