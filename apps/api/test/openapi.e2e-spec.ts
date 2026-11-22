import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('OpenAPI reference (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/openapi.json (GET) serves a public OpenAPI 3.1 document', async () => {
    const response = await request(app.getHttpServer())
      .get('/openapi.json')
      .expect(200)
      .expect('content-type', /application\/json/);

    const document = response.body as {
      openapi: string;
      info: { title: string };
      paths: Record<string, unknown>;
      components?: { securitySchemes?: Record<string, unknown> };
      security?: unknown[];
    };

    expect(document.openapi).toBe('3.1.0');
    expect(document.info.title).toBe('Aya API');
    expect(document.paths['/agent/chat']).toBeDefined();
    expect(document.paths['/agent/chat/stream']).toBeDefined();
    expect(document.paths['/forecast']).toBeDefined();
    expect(document.paths['/alerts']).toBeDefined();
    expect(document.paths['/developers']).toBeDefined();
    expect(document.paths['/admin/users']).toBeDefined();
    expect(document.paths['/notifications']).toBeDefined();
    expect(document.components?.securitySchemes?.ApiKeyAuth).toBeDefined();
    expect(document.components?.securitySchemes?.SessionCookie).toBeDefined();
    // Secured by default; public endpoints override with an empty security list.
    expect(document.security).toEqual([{ ApiKeyAuth: [] }, { SessionCookie: [] }]);
    expect(
      (document.paths['/agent/chat'] as { post: { security?: unknown[] } }).post.security,
    ).toBeUndefined();
  });

  it('/openapi.json (GET) describes request bodies with JSON Schema', async () => {
    const response = await request(app.getHttpServer()).get('/openapi.json').expect(200);
    const document = response.body as {
      paths: Record<
        string,
        {
          post?: { requestBody?: { content: Record<string, { schema: Record<string, unknown> }> } };
        }
      >;
    };

    const schema = document.paths['/agent/chat'].post?.requestBody?.content['application/json']
      .schema as { type: string; required?: string[]; properties?: Record<string, unknown> };

    expect(schema.type).toBe('object');
    expect(schema.required).toContain('message');
    expect(schema.properties?.message).toMatchObject({ type: 'string' });
    expect(schema.properties?.conversationId).toBeDefined();
  });

  it('/docs (GET) serves the interactive reference without inline scripts', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs')
      .expect(200)
      .expect('content-type', /text\/html/);

    expect(response.text).toContain('/docs/swagger-ui-bundle.js');
    expect(response.text).toContain('/docs/init.js');
    // CSP stays strict: the page must not rely on inline scripts.
    expect(response.text).not.toContain('<script>');
  });

  it('/docs/init.js (GET) points Swagger UI at the local document', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs/init.js')
      .expect(200)
      .expect('content-type', /javascript/);

    expect(response.text).toContain("url: '/openapi.json'");
  });

  it('/docs/swagger-ui-bundle.js (GET) serves the static assets', async () => {
    await request(app.getHttpServer())
      .get('/docs/swagger-ui-bundle.js')
      .expect(200)
      .expect('content-type', /javascript/);
  });

  it('/openapi.json (GET) documents query parameters from zod schemas', async () => {
    const response = await request(app.getHttpServer()).get('/openapi.json').expect(200);
    const document = response.body as {
      paths: Record<
        string,
        { get?: { parameters?: Array<{ name: string; in: string; required: boolean }> } }
      >;
    };

    const forecastParams = document.paths['/forecast'].get?.parameters ?? [];
    const names = forecastParams.map((parameter) => parameter.name);
    expect(names).toContain('weeks');
    expect(names).toContain('clientId');
    expect(forecastParams.every((parameter) => parameter.in === 'query')).toBe(true);
    // Defaults make the parameters optional on the input side.
    const weeks = forecastParams.find((parameter) => parameter.name === 'weeks');
    expect(weeks?.required).toBe(false);
  });
});
