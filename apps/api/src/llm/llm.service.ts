import { Injectable } from '@nestjs/common';
import {
  AiError,
  type AiMessage,
  type AiResponse,
  type AiTool,
  createModels,
  getProviderConfig,
} from '@workspace/ai';
import { getServerEnv } from '@workspace/env';
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
  toolCalls?: LlmToolCall[];
  toolCallId?: string;
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

export function toJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  const { $schema: _schemaMetadata, ...jsonSchema } = toJSONSchema(schema, {
    target: 'draft-7',
    io: 'input',
  });
  return jsonSchema;
}

function toAiMessages(messages: LlmMessage[]): AiMessage[] {
  return messages.map((message) => {
    if (message.role === 'assistant' && message.toolCalls) {
      return {
        role: message.role,
        content: message.content,
        toolCalls: message.toolCalls.map((call) => ({
          id: call.id,
          name: call.name,
          arguments: call.args,
        })),
      };
    }
    return message;
  }) as AiMessage[];
}

function toAiTools(tools?: LlmTools): AiTool[] | undefined {
  if (!tools) return undefined;
  return Object.entries(tools).map(([name, tool]) => ({
    name,
    description: tool.description,
    parameters: toJsonSchema(tool.parameters),
  }));
}

@Injectable()
export class LlmService {
  async chat(messages: LlmMessage[], tools?: LlmTools, signal?: AbortSignal): Promise<LlmResponse> {
    try {
      const { models, model } = this.resolveModel();
      const response = await models.complete(model, toAiMessages(messages), {
        tools: toAiTools(tools),
        signal,
        maxTokens: getServerEnv().LLM_MAX_TOKENS,
      });

      return toLlmResponse(response);
    } catch (error) {
      throw mapError(error);
    }
  }

  async chatStream(
    messages: LlmMessage[],
    tools: LlmTools | undefined,
    onDelta: (delta: string) => void,
    signal?: AbortSignal,
  ): Promise<LlmResponse> {
    try {
      const { models, model } = this.resolveModel();
      const response = await models.stream(
        model,
        toAiMessages(messages),
        {
          tools: toAiTools(tools),
          signal,
          maxTokens: getServerEnv().LLM_MAX_TOKENS,
        },
        onDelta,
      );

      return toLlmResponse(response);
    } catch (error) {
      throw mapError(error);
    }
  }

  private resolveModel() {
    const config = getProviderConfig();
    const models = createModels({ config });
    const model = models.getModel(config.provider, config.model);
    if (!model) {
      throw new LlmError(`AI model "${config.provider}/${config.model}" is unavailable.`, 503);
    }
    return { models, model };
  }
}

function toLlmResponse(response: AiResponse): LlmResponse {
  return {
    content: response.content,
    toolCalls: response.toolCalls.map((call) => ({
      id: call.id,
      name: call.name,
      args: call.arguments,
    })),
  };
}

function mapError(error: unknown): Error {
  if (error instanceof AiError) {
    return new LlmError(error.message, error.status === 429 ? 429 : error.status);
  }
  return error instanceof Error ? error : new Error(String(error));
}
