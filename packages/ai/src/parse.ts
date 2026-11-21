import type { AiMessage, AiUsage } from './types.js';

export function parseArguments(value: unknown): Record<string, unknown> {
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

/**
 * Tool results are serialized JSON objects. Providers that expect a
 * structured response (Gemini) need the decoded object, but a tool that
 * returned a scalar or an array still has to be sent as a valid object.
 */
export function toolResponsePayload(content: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { result: parsed ?? content };
  } catch {
    return { result: content };
  }
}

/**
 * Resolves the function name for a tool result by looking back at the
 * assistant turn that requested it. Providers such as Gemini identify a
 * tool result by function name, not by the provider-specific call id.
 */
export function toolNameFor(messages: AiMessage[], toolCallId: string): string | undefined {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message?.role !== 'assistant') continue;
    const call = message.toolCalls?.find((candidate) => candidate.id === toolCallId);
    if (call) return call.name;
  }
  return undefined;
}

export function usageFrom(
  value:
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
): AiUsage | undefined {
  if (!value) return undefined;
  const inputTokens = value.prompt_tokens ?? value.input_tokens ?? value.promptTokenCount;
  const outputTokens = value.completion_tokens ?? value.output_tokens ?? value.candidatesTokenCount;
  return {
    inputTokens,
    outputTokens,
    totalTokens:
      value.total_tokens ??
      value.totalTokenCount ??
      (inputTokens !== undefined && outputTokens !== undefined
        ? inputTokens + outputTokens
        : undefined),
  };
}
