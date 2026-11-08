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
  const llmChatStream = jest.fn();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LlmService)
      .useValue({ chat: llmChat, chatStream: llmChatStream })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.conversation.deleteMany({
      where: { title: { in: ['Find React developers', 'Stream this answer'] } },
    });
  });

  beforeEach(() => {
    llmChat.mockReset();
    llmChatStream.mockReset();
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

  it('streams status, deltas, and a final answer over SSE', async () => {
    llmChatStream.mockImplementation(
      async (
        _messages: unknown,
        _tools: unknown,
        onDelta: (delta: string) => void,
      ): Promise<{ content: string; toolCalls: never[] }> => {
        onDelta('Streaming ');
        onDelta('answer.');
        return { content: 'Streaming answer.', toolCalls: [] };
      },
    );

    const response = await request(app.getHttpServer())
      .post('/agent/chat/stream')
      .set('x-api-key', 'test-api-key')
      .set('accept', 'text/event-stream')
      .send({ message: 'Stream this answer' })
      .expect(200)
      .expect('content-type', /text\/event-stream/);

    expect(response.text).toContain('event: conversation');
    expect(response.text).toContain('event: status');
    expect(response.text).toContain('event: delta');
    expect(response.text).toContain('Streaming ');
    expect(response.text).toContain('event: done');
    expect(response.text).toContain('"conversationId"');

    const doneEvent = response.text.split('\n\n').find((block) => block.includes('event: done'));
    const dataLine = doneEvent?.split('\n').find((line) => line.startsWith('data: '));
    const payload = JSON.parse(dataLine?.slice(6) ?? '{}') as {
      conversationId?: string;
      content?: string;
    };
    expect(payload.content).toBe('Streaming answer.');
    expect(payload.conversationId).toEqual(expect.any(String));

    const conversation = await request(app.getHttpServer())
      .get(`/conversations/${payload.conversationId}`)
      .set('x-api-key', 'test-api-key')
      .expect(200);

    expect(conversation.body.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: 'Stream this answer' }),
        expect.objectContaining({ role: 'assistant', content: 'Streaming answer.' }),
      ]),
    );

    await prisma.conversation.delete({ where: { id: payload.conversationId } });
  });

  it('rejects invalid streaming requests before opening the stream', async () => {
    await request(app.getHttpServer())
      .post('/agent/chat/stream')
      .set('x-api-key', 'test-api-key')
      .send({ message: '' })
      .expect(400);
  });
});
