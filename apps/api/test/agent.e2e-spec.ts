import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { prisma } from '@workspace/db';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { LlmService } from '../src/llm/llm.service';

describe('AgentController (e2e)', () => {
  let app: INestApplication<App>;
  const llmChat = jest.fn();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LlmService)
      .useValue({ chat: llmChat })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.conversation.deleteMany({ where: { title: 'Find React developers' } });
  });

  beforeEach(() => {
    llmChat.mockReset();
  });

  it('executes a tool call and persists the final answer', async () => {
    llmChat
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [
          {
            id: 'call_roster',
            name: 'query_roster',
            args: { skills: ['React'], onBench: null },
          },
        ],
      })
      .mockResolvedValueOnce({
        content: 'The roster query completed.',
        toolCalls: [],
      });

    const response = await request(app.getHttpServer())
      .post('/agent/chat')
      .set('x-api-key', 'test-api-key')
      .send({ message: 'Find React developers' })
      .expect(200);

    expect(response.body).toMatchObject({ content: 'The roster query completed.' });
    expect(llmChat).toHaveBeenCalledTimes(2);

    const secondRequestMessages = llmChat.mock.calls[1]?.[0] as Array<{ role: string }>;
    expect(secondRequestMessages.some((message) => message.role === 'tool')).toBe(true);

    const conversation = await request(app.getHttpServer())
      .get(`/conversations/${response.body.conversationId}`)
      .set('x-api-key', 'test-api-key')
      .expect(200);

    expect(conversation.body.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: 'Find React developers' }),
        expect.objectContaining({ role: 'assistant', content: 'The roster query completed.' }),
      ]),
    );

    await prisma.conversation.delete({ where: { id: response.body.conversationId } });
  });
});
