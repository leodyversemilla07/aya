import { createHash } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { prisma } from '@workspace/db';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableCors({ origin: ['https://allowed.example'], credentials: true });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET) returns the service greeting', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
  });

  it('/health (GET) reports a healthy service', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body).toMatchObject({ status: 'ok', service: 'aya-api' });
  });

  it('allows configured CORS origins and rejects unconfigured origins', async () => {
    const allowed = await request(app.getHttpServer())
      .options('/health')
      .set('Origin', 'https://allowed.example')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);
    expect(allowed.headers['access-control-allow-origin']).toBe('https://allowed.example');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const denied = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'https://untrusted.example')
      .expect(200);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('/health (GET) echoes caller request IDs and generates safe ones', async () => {
    const supplied = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', 'e2e-request-123')
      .expect(200);
    expect(supplied.headers['x-request-id']).toBe('e2e-request-123');

    const generated = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', 'not a valid id')
      .expect(200);
    expect(generated.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(generated.headers['x-request-id']).not.toBe('not a valid id');
  });

  it('returns the request ID in error responses', async () => {
    const response = await request(app.getHttpServer())
      .get('/missing-route')
      .set('x-request-id', 'e2e-error-1234')
      .expect(404);

    expect(response.headers['x-request-id']).toBe('e2e-error-1234');
    expect(response.body.requestId).toBe('e2e-error-1234');
  });

  it('/ready (GET) verifies database connectivity', async () => {
    const response = await request(app.getHttpServer()).get('/ready').expect(200);
    expect(response.body).toMatchObject({ status: 'ready', service: 'aya-api' });
  });

  it('/conversations/:id (GET) bounds and paginates message history', async () => {
    const conversation = await prisma.conversation.create({
      data: {
        title: 'Pagination test',
        accessSubject: `api-key:${createHash('sha256').update('test-api-key').digest('hex')}`,
        messages: {
          create: [
            {
              role: 'user',
              content: 'First message',
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
            },
            {
              role: 'assistant',
              content: 'Second message',
              createdAt: new Date('2026-01-02T00:00:00.000Z'),
            },
            {
              role: 'user',
              content: 'Third message',
              createdAt: new Date('2026-01-03T00:00:00.000Z'),
            },
          ],
        },
      },
    });

    try {
      const firstPage = await request(app.getHttpServer())
        .get(`/conversations/${conversation.id}`)
        .set('x-api-key', 'test-api-key')
        .query({ limit: 2 })
        .expect(200);

      expect(firstPage.body.messages).toHaveLength(2);
      expect(
        firstPage.body.messages.map((message: { content: string }) => message.content),
      ).toEqual(['Second message', 'Third message']);
      expect(firstPage.body.hasMore).toBe(true);
      expect(firstPage.body.nextCursor).toBeTruthy();

      const secondPage = await request(app.getHttpServer())
        .get(`/conversations/${conversation.id}`)
        .set('x-api-key', 'test-api-key')
        .query({ limit: 2, before: firstPage.body.nextCursor })
        .expect(200);

      expect(secondPage.body.messages).toHaveLength(1);
      expect(secondPage.body.messages[0].content).toBe('First message');
      expect(secondPage.body.hasMore).toBe(false);
    } finally {
      await prisma.conversation.delete({ where: { id: conversation.id } });
    }
  });

  it('/agent/chat (POST) rejects invalid bodies with 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/agent/chat')
      .set('x-api-key', 'test-api-key')
      .send({ message: '' })
      .expect(400);

    expect(response.body.message).toContain('message must be a non-empty string');
  });

  it('/agent/chat (POST) rejects missing bodies with 400', async () => {
    await request(app.getHttpServer())
      .post('/agent/chat')
      .set('x-api-key', 'test-api-key')
      .send({})
      .expect(400);
  });

  it('isolates conversations between configured API-key identities', async () => {
    const originalKeys = process.env.API_KEYS;
    process.env.API_KEYS = 'client-a-key,client-b-key';
    const subject = (key: string) => `api-key:${createHash('sha256').update(key).digest('hex')}`;
    const first = await prisma.conversation.create({
      data: { title: 'Client A conversation', accessSubject: subject('client-a-key') },
    });
    const second = await prisma.conversation.create({
      data: { title: 'Client B conversation', accessSubject: subject('client-b-key') },
    });

    try {
      const clientA = await request(app.getHttpServer())
        .get('/conversations')
        .set('x-api-key', 'client-a-key')
        .expect(200);
      expect(clientA.body.map((conversation: { id: string }) => conversation.id)).toContain(
        first.id,
      );
      expect(clientA.body.map((conversation: { id: string }) => conversation.id)).not.toContain(
        second.id,
      );

      const clientB = await request(app.getHttpServer())
        .get('/conversations')
        .set('x-api-key', 'client-b-key')
        .expect(200);
      expect(clientB.body.map((conversation: { id: string }) => conversation.id)).toContain(
        second.id,
      );
      expect(clientB.body.map((conversation: { id: string }) => conversation.id)).not.toContain(
        first.id,
      );
    } finally {
      await prisma.conversation.deleteMany({ where: { id: { in: [first.id, second.id] } } });
      if (originalKeys === undefined) Reflect.deleteProperty(process.env, 'API_KEYS');
      else process.env.API_KEYS = originalKeys;
    }
  });

  it('/agent/chat (POST) enforces the API key before validation', async () => {
    const originalApiKey = process.env.API_KEY;
    process.env.API_KEY = 'e2e-api-key';

    try {
      process.env.API_KEY = '';
      await request(app.getHttpServer()).post('/agent/chat').send({ message: '' }).expect(401);

      process.env.API_KEY = 'e2e-api-key';
      await request(app.getHttpServer())
        .post('/agent/chat')
        .set('x-api-key', 'e2e-api-key')
        .send({ message: '' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/agent/chat')
        .set('authorization', 'Bearer e2e-api-key')
        .send({ message: '' })
        .expect(400);
    } finally {
      process.env.API_KEY = originalApiKey;
    }
  });
});
