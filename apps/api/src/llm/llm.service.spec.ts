import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import { schemas } from '../agent/tools';
import { LlmService, toJsonSchema } from './llm.service';

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, name);
  } else {
    process.env[name] = value;
  }
}

const LLM_ENV_KEYS = ['LLM_PROVIDER', 'LLM_API_KEY', 'LLM_BASE_URL', 'LLM_MAX_RETRIES'] as const;

async function withProviderServer(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  try {
    await run(`http://127.0.0.1:${port}/v1`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function withLlmEnv<T>(
  baseUrl: string,
  maxRetries: string,
  run: () => Promise<T>,
): Promise<T> {
  const previous: Record<string, string | undefined> = {};
  for (const key of LLM_ENV_KEYS) previous[key] = process.env[key];

  process.env.LLM_PROVIDER = 'openai';
  process.env.LLM_API_KEY = 'test-key';
  process.env.LLM_BASE_URL = baseUrl;
  process.env.LLM_MAX_RETRIES = maxRetries;

  try {
    return await run();
  } finally {
    for (const key of LLM_ENV_KEYS) restoreEnv(key, previous[key]);
  }
}

describe('toJsonSchema', () => {
  it('converts every tool schema to an object schema', () => {
    for (const [name, schema] of Object.entries(schemas)) {
      const jsonSchema = toJsonSchema(schema);
      expect(jsonSchema).toMatchObject({ type: 'object' });
      expect(jsonSchema.properties).toBeDefined();
      expect(name).not.toBe('');
    }
  });

  it('converts Zod 4 tool schemas to structured JSON Schema', () => {
    const schema = toJsonSchema(schemas.match_developers);

    expect(schema).toMatchObject({
      type: 'object',
      properties: {
        requiredSkills: {
          type: 'array',
          items: { type: 'string' },
        },
        teamSize: {
          anyOf: [{ type: 'integer' }, { type: 'null' }],
        },
      },
    });
    expect(JSON.stringify(schema)).not.toContain('OpenAiAnyType');
    expect(schema).not.toHaveProperty('$schema');
  });

  it('cancels an in-flight provider request when the caller aborts', async () => {
    const server = createServer(() => {
      // Deliberately never respond; the abort signal must cancel the request.
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const previous = {
      provider: process.env.LLM_PROVIDER,
      apiKey: process.env.LLM_API_KEY,
      baseUrl: process.env.LLM_BASE_URL,
      retries: process.env.LLM_MAX_RETRIES,
    };
    process.env.LLM_PROVIDER = 'openai';
    process.env.LLM_API_KEY = 'test-key';
    process.env.LLM_BASE_URL = `http://127.0.0.1:${port}/v1`;
    process.env.LLM_MAX_RETRIES = '0';

    const controller = new AbortController();
    const request = new LlmService().chat(
      [{ role: 'user', content: 'hello' }],
      undefined,
      controller.signal,
    );
    setTimeout(() => controller.abort(), 25);

    try {
      await expect(request).rejects.toMatchObject({
        status: 504,
        message: expect.stringContaining('cancelled'),
      });
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      restoreEnv('LLM_PROVIDER', previous.provider);
      restoreEnv('LLM_API_KEY', previous.apiKey);
      restoreEnv('LLM_BASE_URL', previous.baseUrl);
      restoreEnv('LLM_MAX_RETRIES', previous.retries);
    }
  });

  it('preserves nullable optional enum fields', () => {
    const schema = toJsonSchema(schemas.get_alerts);

    expect(schema).toMatchObject({
      type: 'object',
      properties: {
        type: {
          anyOf: [
            {
              type: 'string',
              enum: ['all', 'bench', 'contract', 'performance'],
            },
            { type: 'null' },
          ],
        },
      },
    });
  });
});

describe('LlmService.chatStream', () => {
  it('streams text deltas and returns the accumulated response', async () => {
    const deltas: string[] = [];
    let requestBody: Record<string, unknown> = {};

    await withProviderServer(
      (request, response) => {
        let body = '';
        request.on('data', (chunk) => {
          body += chunk;
        });
        request.on('end', () => {
          requestBody = JSON.parse(body) as Record<string, unknown>;
          response.writeHead(200, { 'content-type': 'text/event-stream' });
          response.write(
            'data: {"choices":[{"delta":{"content":"Hello "},"finish_reason":null}]}\n\n',
          );
          response.write(
            'data: {"choices":[{"delta":{"content":"world"},"finish_reason":null}]}\n\n',
          );
          response.write('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n');
          response.end('data: [DONE]\n\n');
        });
      },
      async (baseUrl) => {
        await withLlmEnv(baseUrl, '0', async () => {
          const result = await new LlmService().chatStream(
            [{ role: 'user', content: 'hello' }],
            undefined,
            (delta) => deltas.push(delta),
          );

          expect(result).toEqual({ content: 'Hello world', toolCalls: [] });
        });
      },
    );

    expect(deltas).toEqual(['Hello ', 'world']);
    expect(requestBody.stream).toBe(true);
  });

  it('assembles tool calls split across streamed chunks', async () => {
    await withProviderServer(
      (request, response) => {
        request.resume();
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.write(
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"query_roster","arguments":"{\\"skills\\":"}}]},"finish_reason":null}]}\n\n',
        );
        response.write(
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"[\\"React\\"]}"}}]},"finish_reason":null}]}\n\n',
        );
        response.write('data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n');
        response.end('data: [DONE]\n\n');
      },
      async (baseUrl) => {
        await withLlmEnv(baseUrl, '0', async () => {
          const result = await new LlmService().chatStream(
            [{ role: 'user', content: 'find react devs' }],
            undefined,
            () => {},
          );

          expect(result).toEqual({
            content: '',
            toolCalls: [
              {
                id: 'call_1',
                name: 'query_roster',
                args: { skills: ['React'] },
              },
            ],
          });
        });
      },
    );
  });

  it('does not retry after a partial delta was emitted', async () => {
    let requests = 0;
    const deltas: string[] = [];

    await withProviderServer(
      (request, response) => {
        requests++;
        request.resume();
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.write('data: {"choices":[{"delta":{"content":"Partial"}}]}\n\n');
        setTimeout(() => response.destroy(), 25);
      },
      async (baseUrl) => {
        await withLlmEnv(baseUrl, '3', async () => {
          await expect(
            new LlmService().chatStream([{ role: 'user', content: 'hello' }], undefined, (delta) =>
              deltas.push(delta),
            ),
          ).rejects.toMatchObject({
            status: 502,
            message: expect.stringContaining('stream ended unexpectedly'),
          });
        });
      },
    );

    expect(requests).toBe(1);
    expect(deltas).toEqual(['Partial']);
  });
});
