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

  it('/ready (GET) verifies database connectivity', async () => {
    const response = await request(app.getHttpServer()).get('/ready').expect(200);
    expect(response.body).toMatchObject({ status: 'ready', service: 'aya-api' });
  });

  it('/conversations/:id (GET) bounds and paginates message history', async () => {
    const conversation = await prisma.conversation.create({
      data: {
        title: 'Pagination test',
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
