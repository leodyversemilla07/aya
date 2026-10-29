import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { prisma } from '@workspace/db';
import { type LlmMessage, LlmService } from '../llm/llm.service';
import { executeTool, tools } from './tools';

const MAX_ITERATIONS = 4;
const MAX_COMPLETIONS = MAX_ITERATIONS + 2;
const HISTORY_LIMIT = 20;
const HISTORY_MAX_CHARS = 40_000;
const AGENT_TIMEOUT_MS = Math.min(
  10 * 60_000,
  Math.max(5_000, Number(process.env.AGENT_TIMEOUT_MS ?? 180_000) || 180_000),
);

function buildSystemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);

  return `You are Aya, an AI assistant for staff augmentation management at a software development company.

Today's date is ${today}. Always use this date when reasoning about availability, contract expiry, and renewal deadlines. Never invent dates, developers, clients, contracts, or metrics.

Your job is to help managers:
- Find available developers by skills, availability, or client
- Match developers to new project requirements
- Track utilization rates and team performance
- Monitor contract status and renewal deadlines
- Plan developer transitions between clients
- Generate proactive alerts about risks

You have access to tools that query the developer roster, clients, assignments, contracts, and performance data. Use them whenever the answer depends on company data. If a tool returns an error, explain the problem briefly and ask for the missing detail instead of guessing.

Always be concise, data-driven, and actionable. When presenting options, rank them with reasoning. Use tables or lists for readability. Flag risks proactively.`;
}

interface PendingMessage {
  role: 'assistant' | 'tool';
  content: string;
  toolCalls?: string | null;
  toolCallId?: string | null;
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(private readonly llmService: LlmService) {}

  async chat(message: string, conversationId?: string, clientSignal?: AbortSignal) {
    let conversation = conversationId
      ? await prisma.conversation.findUnique({ where: { id: conversationId } })
      : null;

    if (conversationId && !conversation) {
      throw new NotFoundException(`Conversation "${conversationId}" was not found.`);
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { title: message.slice(0, 80) },
      });
    }

    // Only user/assistant messages are sent back to the model. Query just the
    // bounded history needed for the model instead of loading every stored
    // tool message first.
    const storedHistory = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        role: { in: ['user', 'assistant'] },
        content: { not: '' },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: HISTORY_LIMIT,
      select: { role: true, content: true },
    });
    const historyMessages: typeof storedHistory = [];
    let historyChars = 0;
    for (const storedMessage of storedHistory) {
      const content = storedMessage.content.trim();
      if (content.length === 0 || historyChars + content.length > HISTORY_MAX_CHARS) {
        continue;
      }
      historyChars += content.length;
      historyMessages.unshift(storedMessage);
    }
    const history: LlmMessage[] = historyMessages.map((storedMessage) => ({
      role: storedMessage.role as 'user' | 'assistant',
      content: storedMessage.content,
    }));

    const messages: LlmMessage[] = [
      { role: 'system', content: buildSystemPrompt() },
      ...history,
      { role: 'user', content: message },
    ];

    await prisma.message.create({
      data: {
        role: 'user',
        content: message,
        conversationId: conversation.id,
      },
    });

    const deadlineSignal = AbortSignal.timeout(AGENT_TIMEOUT_MS);
    const requestSignal = clientSignal
      ? AbortSignal.any([clientSignal, deadlineSignal])
      : deadlineSignal;

    const pendingMessages: PendingMessage[] = [];
    let completionCount = 1;
    let response = await this.llmService.chat(messages, tools, requestSignal);

    while (response.toolCalls.length > 0 && completionCount < MAX_COMPLETIONS - 1) {
      const toolResults = await Promise.all(
        response.toolCalls.map(async (toolCall) => ({
          role: 'tool' as const,
          content: JSON.stringify(await executeTool(toolCall.name, toolCall.args)),
          toolCallId: toolCall.id,
        })),
      );

      pendingMessages.push({
        role: 'assistant',
        content: response.content,
        toolCalls: JSON.stringify(response.toolCalls),
      });
      for (const toolResult of toolResults) {
        pendingMessages.push({
          role: 'tool',
          content: toolResult.content,
          toolCallId: toolResult.toolCallId,
        });
      }

      messages.push({
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls,
      });
      messages.push(...toolResults);

      response = await this.llmService.chat(messages, tools, requestSignal);
      completionCount++;
    }

    if (response.toolCalls.length > 0) {
      this.logger.warn(
        `Conversation ${conversation.id} reached the tool iteration limit; requesting a final answer.`,
      );
      messages.push({
        role: 'user',
        content:
          'Please provide your final answer using the tool results already gathered. Do not call any more tools.',
      });

      const finalResponse = await this.llmService.chat(messages, undefined, requestSignal);
      response = {
        content:
          finalResponse.content.trim() ||
          'I gathered the data but could not produce a final answer. Please refine your question.',
        toolCalls: [],
      };
    }

    const content =
      response.content.trim() ||
      'I could not generate a response for that request. Please try rephrasing it.';

    pendingMessages.push({ role: 'assistant', content });

    await prisma.$transaction(async (transaction) => {
      for (const pendingMessage of pendingMessages) {
        await transaction.message.create({
          data: {
            role: pendingMessage.role,
            content: pendingMessage.content,
            toolCalls: pendingMessage.toolCalls ?? null,
            toolCallId: pendingMessage.toolCallId ?? null,
            conversationId: conversation.id,
          },
        });
      }

      await transaction.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });
    });

    return {
      conversationId: conversation.id,
      content,
    };
  }
}
