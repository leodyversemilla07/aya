import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { prisma } from '@workspace/db';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { LlmService } from '../src/llm/llm.service';

describe('Chat quota (e2e)', () => {
  let app: INestApplication<App>;
  const llmChat = jest.fn();
  const llmChatStream = jest.fn();
  const originalQuota = process.env.CHAT_DAILY_QUOTA;

  beforeAll(async () => {
    process.env.CHAT_DAILY_QUOTA = '1';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LlmService)
      .useValue({ chat: llmChat, chatStream: llmChatStream })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await prisma.chatUsage.deleteMany({ where: { subject: 'api-key' } });
  });

  afterAll(async () => {
    await app.close();
    await prisma.chatUsage.deleteMany({ where: { subject: 'api-key' } });
    await prisma.conversation.deleteMany({ where: { title: 'Quota test question' } });

    if (originalQuota === undefined) {
      Reflect.deleteProperty(process.env, 'CHAT_DAILY_QUOTA');
    } else {
      process.env.CHAT_DAILY_QUOTA = originalQuota;
    }
  });

  beforeEach(() => {
    llmChat.mockReset();
    llmChatStream.mockReset();
  });

  it('persists usage and rejects the next request with quota headers', async () => {
    llmChat.mockResolvedValue({ content: 'Allowed answer', toolCalls: [] });

    const first = await request(app.getHttpServer())
      .post('/agent/chat')
      .set('x-api-key', 'test-api-key')
      .send({ message: 'Quota test question' })
      .expect(200);

    expect(first.headers['x-chat-quota-limit']).toBe('1');
    expect(first.headers['x-chat-quota-used']).toBe('1');
    expect(first.headers['x-chat-quota-remaining']).toBe('0');
    expect(first.headers['x-chat-quota-reset']).toEqual(expect.any(String));

    const day = new Date().toISOString().slice(0, 10);
    const usage = await prisma.chatUsage.findUnique({
      where: { subject_day: { subject: 'api-key', day } },
    });
    expect(usage?.count).toBe(1);

    const second = await request(app.getHttpServer())
      .post('/agent/chat/stream')
      .set('x-api-key', 'test-api-key')
      .set('accept', 'text/event-stream')
      .send({ message: 'Quota test question' })
      .expect(429);

    expect(second.headers['x-chat-quota-remaining']).toBe('0');
    expect(second.headers['retry-after']).toMatch(/^\d+$/);
    expect(second.body.message).toContain('Daily chat quota');
    expect(second.body.requestId).toEqual(expect.any(String));
    expect(llmChat).toHaveBeenCalledTimes(1);
    expect(llmChatStream).not.toHaveBeenCalled();

    // The over-limit attempt is clamped so the counter cannot grow forever.
    const clamped = await prisma.chatUsage.findUnique({
      where: { subject_day: { subject: 'api-key', day } },
    });
    expect(clamped?.count).toBe(1);
  });
});
