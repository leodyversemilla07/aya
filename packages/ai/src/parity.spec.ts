import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createAiClient } from './index.js';
import type { AiMessage, AiProviderConfig, AiResponse } from './types.js';

interface ParityServer {
  baseUrl: string;
  close: () => Promise<void>;
}

const servers: ParityServer[] = [];

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    await server?.close();
  }
});

async function startServer(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
): Promise<ParityServer> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const providerServer: ParityServer = {
    baseUrl: `http://127.0.0.1:${port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
  servers.push(providerServer);
  return providerServer;
}

function sse(events: string[]): string {
  return events.map((event) => `data: ${event}\n\n`).join('');
}

const MESSAGES: AiMessage[] = [
  { role: 'system', content: 'You are Aya.' },
  { role: 'user', content: 'find react developers' },
];

const EXPECTED = {
  content: 'Here is the roster.',
  toolCall: { name: 'query_roster', arguments: { skills: ['React'] } },
  usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20 },
};

function normalize(response: AiResponse) {
  return {
    content: response.content,
    toolCalls: response.toolCalls.map((call) => ({
      name: call.name,
      arguments: call.arguments,
    })),
    usage: response.usage,
    streamMode: response.streamMode,
  };
}

const DIALECTS: Array<{
  name: string;
  config: (baseUrl: string) => AiProviderConfig;
  fixture: () => string;
}> = [
  {
    name: 'openai-compatible',
    config: (baseUrl) => ({
      provider: 'openai',
      apiKey: 'test-key',
      model: 'test-model',
      baseUrl: `${baseUrl}/v1`,
      timeoutMs: 5_000,
      maxRetries: 0,
    }),
    fixture: () =>
      sse([
        JSON.stringify({
          choices: [{ delta: { content: 'Here is the roster.' }, finish_reason: null }],
        }),
        JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: 'call_1',
                    function: { name: 'query_roster', arguments: '{"skills":["React"]}' },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        }),
        JSON.stringify({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }),
        JSON.stringify({
          usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
        }),
        '[DONE]',
      ]),
  },
  {
    name: 'anthropic',
    config: (baseUrl) => ({
      provider: 'anthropic',
      apiKey: 'test-key',
      model: 'test-model',
      baseUrl,
      timeoutMs: 5_000,
      maxRetries: 0,
    }),
    fixture: () =>
      sse([
        JSON.stringify({
          type: 'message_start',
          message: { usage: { input_tokens: 12, output_tokens: 1 } },
        }),
        JSON.stringify({
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '' },
        }),
        JSON.stringify({
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'Here is the roster.' },
        }),
        JSON.stringify({ type: 'content_block_stop', index: 0 }),
        JSON.stringify({
          type: 'content_block_start',
          index: 1,
          content_block: { type: 'tool_use', id: 'call_1', name: 'query_roster', input: {} },
        }),
        JSON.stringify({
          type: 'content_block_delta',
          index: 1,
          delta: { type: 'input_json_delta', partial_json: '{"skills":["React"]}' },
        }),
        JSON.stringify({ type: 'content_block_stop', index: 1 }),
        JSON.stringify({
          type: 'message_delta',
          delta: { stop_reason: 'tool_use' },
          usage: { output_tokens: 8 },
        }),
        JSON.stringify({ type: 'message_stop' }),
      ]),
  },
  {
    name: 'google',
    config: (baseUrl) => ({
      provider: 'google',
      apiKey: 'test-key',
      model: 'test-model',
      baseUrl,
      timeoutMs: 5_000,
      maxRetries: 0,
    }),
    fixture: () =>
      sse([
        JSON.stringify({
          candidates: [{ content: { role: 'model', parts: [{ text: 'Here is the roster.' }] } }],
        }),
        JSON.stringify({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [{ functionCall: { name: 'query_roster', args: { skills: ['React'] } } }],
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: {
            promptTokenCount: 12,
            candidatesTokenCount: 8,
            totalTokenCount: 20,
          },
        }),
      ]),
  },
];

describe('provider streaming parity', () => {
  it('produces the same normalized result for every provider dialect', async () => {
    const results: Array<{ dialect: string; value: ReturnType<typeof normalize> }> = [];

    for (const dialect of DIALECTS) {
      const server = await startServer((request, response) => {
        request.resume();
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.write(dialect.fixture());
        response.end();
      });

      const response = await createAiClient(dialect.config(server.baseUrl)).stream(MESSAGES, {});
      results.push({ dialect: dialect.name, value: normalize(response) });
    }

    for (const result of results) {
      expect(result.value, result.dialect).toEqual({
        content: EXPECTED.content,
        toolCalls: [EXPECTED.toolCall],
        usage: EXPECTED.usage,
        streamMode: 'native',
      });
    }

    const [first, ...rest] = results;
    for (const result of rest) {
      expect(result.value, `${first?.dialect} vs ${result.dialect}`).toEqual(first?.value);
    }
  });
});
