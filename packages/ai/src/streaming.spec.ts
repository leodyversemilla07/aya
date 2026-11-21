import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { AiError } from './errors.js';
import { createAiClient } from './index.js';
import type { AiMessage, AiProviderConfig } from './types.js';

interface CapturedRequest {
  url: string;
  body: Record<string, unknown>;
}

interface ProviderServer {
  baseUrl: string;
  requests: CapturedRequest[];
  close: () => Promise<void>;
}

const servers: ProviderServer[] = [];

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    await server?.close();
  }
});

async function startProviderServer(
  handler: (request: IncomingMessage, response: ServerResponse, body: string) => void,
): Promise<ProviderServer> {
  const requests: CapturedRequest[] = [];
  const server = createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += chunk;
    });
    request.on('end', () => {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        body = {};
      }
      requests.push({ url: request.url ?? '', body });
      handler(request, response, raw);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  const providerServer: ProviderServer = {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
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

function anthropicConfig(baseUrl: string): AiProviderConfig {
  return {
    provider: 'anthropic',
    apiKey: 'test-anthropic-key',
    model: 'claude-test',
    baseUrl,
    timeoutMs: 5_000,
    maxRetries: 0,
  };
}

function googleConfig(baseUrl: string): AiProviderConfig {
  return {
    provider: 'google',
    apiKey: 'test-google-key',
    model: 'gemini-test',
    baseUrl,
    timeoutMs: 5_000,
    maxRetries: 0,
  };
}

const TOOL: AiMessage[] = [{ role: 'user', content: 'find react developers' }];

describe('Anthropic native streaming', () => {
  it('streams text deltas and reports usage and stop reason', async () => {
    const server = await startProviderServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.write(
        sse([
          JSON.stringify({
            type: 'message_start',
            message: {
              id: 'msg_1',
              role: 'assistant',
              model: 'claude-test',
              usage: { input_tokens: 24, output_tokens: 1 },
            },
          }),
          JSON.stringify({
            type: 'content_block_start',
            index: 0,
            content_block: { type: 'text', text: '' },
          }),
          JSON.stringify({
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'Hello ' },
          }),
          JSON.stringify({
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'world' },
          }),
          JSON.stringify({ type: 'content_block_stop', index: 0 }),
          JSON.stringify({
            type: 'message_delta',
            delta: { stop_reason: 'end_turn', stop_sequence: null },
            usage: { output_tokens: 9 },
          }),
          JSON.stringify({ type: 'message_stop' }),
        ]),
      );
      response.end();
    });

    const deltas: string[] = [];
    const response = await createAiClient(anthropicConfig(server.baseUrl)).stream(
      [{ role: 'user', content: 'hello' }],
      {},
      (delta) => deltas.push(delta),
    );

    expect(deltas).toEqual(['Hello ', 'world']);
    expect(response.content).toBe('Hello world');
    expect(response.toolCalls).toEqual([]);
    expect(response.usage).toEqual({ inputTokens: 24, outputTokens: 9, totalTokens: 33 });
    expect(response.finishReason).toBe('end_turn');
    expect(response.streamMode).toBe('native');
    expect(server.requests[0]?.url).toBe('/v1/messages');
    expect(server.requests[0]?.body).toMatchObject({ stream: true, model: 'claude-test' });
  });

  it('assembles tool calls streamed as partial JSON', async () => {
    const server = await startProviderServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.write(
        sse([
          JSON.stringify({ type: 'message_start', message: { usage: { input_tokens: 12 } } }),
          JSON.stringify({
            type: 'content_block_start',
            index: 0,
            content_block: { type: 'tool_use', id: 'toolu_1', name: 'query_roster', input: {} },
          }),
          JSON.stringify({
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'input_json_delta', partial_json: '{"skills":' },
          }),
          JSON.stringify({
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'input_json_delta', partial_json: '["React"]}' },
          }),
          JSON.stringify({ type: 'content_block_stop', index: 0 }),
          JSON.stringify({
            type: 'message_delta',
            delta: { stop_reason: 'tool_use' },
            usage: { output_tokens: 7 },
          }),
          JSON.stringify({ type: 'message_stop' }),
        ]),
      );
      response.end();
    });

    const response = await createAiClient(anthropicConfig(server.baseUrl)).stream(TOOL, {});

    expect(response.toolCalls).toEqual([
      { id: 'toolu_1', name: 'query_roster', arguments: { skills: ['React'] } },
    ]);
    expect(response.finishReason).toBe('tool_use');
    expect(response.usage).toEqual({ inputTokens: 12, outputTokens: 7, totalTokens: 19 });
  });

  it('sends tool results as tool_use blocks in the following user turn', async () => {
    const server = await startProviderServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.write(
        sse([
          JSON.stringify({ type: 'message_start', message: { usage: { input_tokens: 1 } } }),
          JSON.stringify({
            type: 'content_block_start',
            index: 0,
            content_block: { type: 'text', text: '' },
          }),
          JSON.stringify({
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'ok' },
          }),
          JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' } }),
          JSON.stringify({ type: 'message_stop' }),
        ]),
      );
      response.end();
    });

    const messages: AiMessage[] = [
      { role: 'system', content: 'You are Aya.' },
      { role: 'user', content: 'find react developers' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'toolu_1', name: 'query_roster', arguments: { skills: ['React'] } }],
      },
      { role: 'tool', content: '{"developers":[]}', toolCallId: 'toolu_1' },
    ];

    await createAiClient(anthropicConfig(server.baseUrl)).stream(messages, {});

    const body = server.requests[0]?.body as {
      system?: string;
      messages?: Array<{ role: string; content: Array<Record<string, unknown>> }>;
    };
    expect(body.system).toBe('You are Aya.');
    expect(body.messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'find react developers' }] },
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'toolu_1', name: 'query_roster', input: { skills: ['React'] } },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: '{"developers":[]}' }],
      },
    ]);
  });

  it('drops silent assistant turns instead of sending empty text blocks', async () => {
    const server = await startProviderServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.write(
        sse([
          JSON.stringify({ type: 'message_start', message: { usage: { input_tokens: 1 } } }),
          JSON.stringify({
            type: 'content_block_start',
            index: 0,
            content_block: { type: 'text', text: '' },
          }),
          JSON.stringify({
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'ok' },
          }),
          JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' } }),
          JSON.stringify({ type: 'message_stop' }),
        ]),
      );
      response.end();
    });

    await createAiClient(anthropicConfig(server.baseUrl)).stream(
      [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: '   ' },
        { role: 'user', content: 'still there?' },
      ],
      {},
    );

    const body = server.requests[0]?.body as {
      messages?: Array<{ role: string; content: Array<Record<string, unknown>> }>;
    };
    expect(body.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'hello' },
          { type: 'text', text: 'still there?' },
        ],
      },
    ]);
  });

  it('surfaces provider stream errors', async () => {
    const server = await startProviderServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.write(
        sse([
          JSON.stringify({
            type: 'error',
            error: { type: 'overloaded_error', message: 'Overloaded' },
          }),
        ]),
      );
      response.end();
    });

    await expect(
      createAiClient(anthropicConfig(server.baseUrl)).stream([{ role: 'user', content: 'hi' }], {}),
    ).rejects.toThrowError(AiError);
  });
});

describe('Google native streaming', () => {
  it('streams text deltas and function calls', async () => {
    const server = await startProviderServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.write(
        sse([
          JSON.stringify({
            candidates: [{ content: { role: 'model', parts: [{ text: 'Hello ' }] } }],
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2 },
          }),
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    { text: 'world' },
                    { functionCall: { name: 'query_roster', args: { skills: ['React'] } } },
                  ],
                },
                finishReason: 'STOP',
              },
            ],
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 6,
              totalTokenCount: 16,
            },
          }),
        ]),
      );
      response.end();
    });

    const deltas: string[] = [];
    const response = await createAiClient(googleConfig(server.baseUrl)).stream(
      [{ role: 'user', content: 'hello' }],
      {},
      (delta) => deltas.push(delta),
    );

    expect(deltas).toEqual(['Hello ', 'world']);
    expect(response.content).toBe('Hello world');
    expect(response.toolCalls).toHaveLength(1);
    expect(response.toolCalls[0]).toMatchObject({
      name: 'query_roster',
      arguments: { skills: ['React'] },
    });
    expect(response.usage).toEqual({ inputTokens: 10, outputTokens: 6, totalTokens: 16 });
    expect(response.finishReason).toBe('STOP');
    expect(response.streamMode).toBe('native');
    expect(server.requests[0]?.url).toContain('/models/gemini-test:streamGenerateContent');
    expect(server.requests[0]?.url).toContain('alt=sse');
  });

  it('sends function responses keyed by the function name', async () => {
    const server = await startProviderServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.write(
        sse([
          JSON.stringify({
            candidates: [{ content: { role: 'model', parts: [{ text: 'done' }] } }],
          }),
        ]),
      );
      response.end();
    });

    const messages: AiMessage[] = [
      { role: 'system', content: 'You are Aya.' },
      { role: 'user', content: 'find react developers' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'call_1', name: 'query_roster', arguments: { skills: ['React'] } }],
      },
      { role: 'tool', content: '{"developers":[]}', toolCallId: 'call_1' },
    ];

    await createAiClient(googleConfig(server.baseUrl)).stream(messages, {});

    const body = server.requests[0]?.body as {
      systemInstruction?: { parts: Array<{ text: string }> };
      contents?: Array<{ role: string; parts: Array<Record<string, unknown>> }>;
    };
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'You are Aya.' }] });
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: 'find react developers' }] },
      {
        role: 'model',
        parts: [{ functionCall: { name: 'query_roster', args: { skills: ['React'] } } }],
      },
      {
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: 'query_roster',
              response: { developers: [] },
            },
          },
        ],
      },
    ]);
  });

  it('reports blocked prompts as a request error', async () => {
    const server = await startProviderServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.write(
        sse([
          JSON.stringify({
            promptFeedback: { blockReason: 'SAFETY', blockReasonMessage: 'blocked' },
          }),
        ]),
      );
      response.end();
    });

    await expect(
      createAiClient(googleConfig(server.baseUrl)).stream([{ role: 'user', content: 'hi' }], {}),
    ).rejects.toMatchObject({ status: 422 });
  });
});
