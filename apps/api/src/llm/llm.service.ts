import { Injectable } from '@nestjs/common';

export interface LlmToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
}

export interface LlmResponse {
  content: string;
  toolCalls: LlmToolCall[];
}

function getProviderConfig() {
  const provider = (process.env.LLM_PROVIDER || 'opencode-zen').toLowerCase();
  const apiKey = process.env.LLM_API_KEY;
  const modelName = process.env.LLM_MODEL;

  switch (provider) {
    case 'openai':
      return { baseURL: 'https://api.openai.com/v1', model: modelName || 'gpt-4o-mini', apiKey };
    case 'openrouter':
      return {
        baseURL: 'https://openrouter.ai/api/v1',
        model: modelName || 'google/gemma-4-26b-a4b-it:free',
        apiKey,
      };
    default:
      return {
        baseURL: 'https://opencode.ai/zen/v1',
        model: modelName || 'minimax-m2.5-free',
        apiKey,
      };
  }
}

function zodToJsonSchema(zodSchema: any): Record<string, unknown> {
  // Convert Vercel AI SDK Zod-based tool definitions to OpenAI-compatible JSON schema
  const shape = zodSchema._def?.shape?.() ?? {};
  const required: string[] = [];
  const properties: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(shape)) {
    const field = value as any;
    const typeName = field._def?.typeName;
    const desc = field._def?.description ?? '';
    const prop: Record<string, unknown> = {};

    if (typeName === 'ZodString') prop.type = 'string';
    else if (typeName === 'ZodNumber') prop.type = 'number';
    else if (typeName === 'ZodBoolean') prop.type = 'boolean';
    else if (typeName === 'ZodArray') {
      prop.type = 'array';
      const innerType = field._def?.type?._def?.typeName;
      if (innerType === 'ZodString') prop.items = { type: 'string' };
    } else if (typeName === 'ZodEnum') prop.type = 'string';
    else prop.type = 'string';

    if (desc) prop.description = desc;

    // Check if field is NOT optional (no ZodOptional wrapper)
    if (typeName !== 'ZodOptional') {
      required.push(key);
    }
    // If it's ZodOptional, unwrap and get inner type
    if (typeName === 'ZodOptional') {
      const inner = field._def?.innerType;
      const innerTypeName = inner?._def?.typeName;
      if (innerTypeName === 'ZodString') prop.type = 'string';
      else if (innerTypeName === 'ZodNumber') prop.type = 'number';
      else if (innerTypeName === 'ZodBoolean') prop.type = 'boolean';
      else if (innerTypeName === 'ZodArray') {
        prop.type = 'array';
        const innerItemType = inner?._def?.type?._def?.typeName;
        if (innerItemType === 'ZodString') prop.items = { type: 'string' };
      } else if (innerTypeName === 'ZodEnum') {
        prop.type = 'string';
        prop.enum = inner._def?.values;
      }
      const innerDesc = inner?._def?.description;
      if (innerDesc) prop.description = innerDesc;
    }
    // Handle ZodDefault
    if (typeName === 'ZodDefault') {
      const inner = field._def?.innerType;
      const innerTypeName = inner?._def?.typeName;
      if (innerTypeName === 'ZodString') prop.type = 'string';
      else if (innerTypeName === 'ZodNumber') prop.type = 'number';
      else if (innerTypeName === 'ZodBoolean') prop.type = 'boolean';
      const innerDesc = inner?._def?.description;
      if (innerDesc) prop.description = innerDesc;
      // Remove from required since it has a default
      const idx = required.indexOf(key);
      if (idx >= 0) required.splice(idx, 1);
    }

    properties[key] = prop;
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

@Injectable()
export class LlmService {
  async chat(messages: LlmMessage[], tools?: Record<string, any>): Promise<LlmResponse> {
    const config = getProviderConfig();

    // Convert messages to OpenAI format
    const apiMessages = messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          content: m.content,
          tool_call_id: m.toolCallId!,
        };
      }
      const msg: any = { role: m.role, content: m.content };
      if (m.role === 'assistant' && m.toolCalls) {
        msg.tool_calls = m.toolCalls.map((tc: any) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args),
          },
        }));
      }
      return msg;
    });

    // Convert tools to OpenAI format
    let apiTools: any[] | undefined;
    if (tools) {
      apiTools = Object.entries(tools).map(([name, toolDef]: [string, any]) => ({
        type: 'function',
        function: {
          name,
          description: toolDef.description || '',
          parameters: zodToJsonSchema(toolDef.parameters),
        },
      }));
    }

    const body: Record<string, unknown> = {
      model: config.model,
      messages: apiMessages,
      max_tokens: 4096,
    };
    if (apiTools && apiTools.length > 0) {
      body.tools = apiTools;
    }

    const res = await fetch(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LLM API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    if (!choice) throw new Error('No response from LLM');

    const toolCalls: LlmToolCall[] = (choice.message?.tool_calls || []).map((tc: any) => ({
      id: tc.id,
      name: tc.function?.name,
      args: JSON.parse(tc.function?.arguments || '{}'),
    }));

    return {
      content: choice.message?.content || '',
      toolCalls,
    };
  }
}
