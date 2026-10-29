import { createServer } from 'node:http';
import { schemas } from '../agent/tools';
import { LlmService, toJsonSchema } from './llm.service';

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, name);
  } else {
    process.env[name] = value;
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
