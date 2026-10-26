import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { prisma } from '@workspace/db';
import { type LlmMessage, LlmService } from '../llm/llm.service';
import { executeTool, tools } from './tools';

const MAX_ITERATIONS = 5;
const HISTORY_LIMIT = 20;

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

  async chat(message: string, conversationId?: string) {
    let conversation = conversationId
      ? await prisma.conversation.findUnique({
          where: { id: conversationId },
          include: { messages: { orderBy: { createdAt: 'asc' } } },
        })
      : null;

    if (conversationId && !conversation) {
      throw new NotFoundException(`Conversation "${conversationId}" was not found.`);
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { title: message.slice(0, 80) },
        include: { messages: true },
      });
    }

    // Only user/assistant messages are sent back to the model. Tool traffic is
    // only needed within a single turn, and old tool-call groups can become
    // invalid when history is truncated.
    const history: LlmMessage[] = conversation.messages
      .filter(
        (storedMessage) =>
          storedMessage.role === 'user' ||
          (storedMessage.role === 'assistant' && storedMessage.content.trim().length > 0),
      )
      .slice(-HISTORY_LIMIT)
      .map((storedMessage) => ({
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

    const pendingMessages: PendingMessage[] = [];
    let response = await this.llmService.chat(messages, tools);
    let iterations = 0;

    while (response.toolCalls.length > 0 && iterations < MAX_ITERATIONS) {
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

      response = await this.llmService.chat(messages, tools);
      iterations++;
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

      const finalResponse = await this.llmService.chat(messages);
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
