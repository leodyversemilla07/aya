import { Injectable } from '@nestjs/common';
import { prisma } from '@workspace/db';
import { LlmService } from '../llm/llm.service';
import { executeTool, tools } from './tools';

const SYSTEM_PROMPT = `You are Aya, an AI assistant for staff augmentation management at a software development company.

Your job is to help managers:
- Find available developers by skills, availability, or client
- Match developers to new project requirements
- Track utilization rates and team performance
- Monitor contract status and renewal deadlines
- Plan developer transitions between clients
- Generate proactive alerts about risks

You have access to tools to query the developer roster, clients, assignments, contracts, and performance data.

Always be concise, data-driven, and actionable. When presenting options, rank them with reasoning.
Use tables or lists for readability. Flag risks proactively.`;

@Injectable()
export class AgentService {
  constructor(private readonly llmService: LlmService) {}

  async chat(message: string, conversationId?: string) {
    // Get or create conversation
    let conversation: any = null;
    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
    }
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { title: message.slice(0, 80) },
        include: { messages: true },
      });
    }

    // Build messages for LLM
    const messages: any[] = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...conversation.messages.map((m) => {
        const msg: any = {
          role: m.role,
          content: m.content,
        };
        if (m.toolCallId) {
          msg.toolCallId = m.toolCallId;
        }
        if (m.toolCalls) {
          try {
            msg.toolCalls = JSON.parse(m.toolCalls);
          } catch (parseErr) {
            // Invalid JSON stored - skip tool calls
            console.warn('Failed to parse toolCalls from message:', m.id, parseErr);
          }
        }
        return msg;
      }),
      { role: 'user' as const, content: message },
    ];

    // Save user message
    await prisma.message.create({
      data: {
        role: 'user',
        content: message,
        conversationId: conversation.id,
      },
    });

    // Agent loop: LLM decides -> execute tools -> feed back -> repeat
    let response = await this.llmService.chat(messages, tools as any);
    let iterations = 0;
    const MAX_ITERATIONS = 5;

    while (response.toolCalls && response.toolCalls.length > 0 && iterations < MAX_ITERATIONS) {
      // Execute each tool call
      const toolResults: Array<{ role: 'tool'; content: string; toolCallId: string }> = [];
      for (const toolCall of response.toolCalls) {
        const result = await executeTool(toolCall.name, toolCall.args);
        toolResults.push({
          role: 'tool' as const,
          content: JSON.stringify(result),
          toolCallId: toolCall.id,
        });
      }

      // Add assistant message (with tool calls) and tool results to conversation
      messages.push({
        role: 'assistant',
        content: response.content || '',
        toolCalls: response.toolCalls,
      });
      messages.push(...toolResults);

      // Save assistant message (with tool calls) to DB
      const assistantDbMsg = await prisma.message.create({
        data: {
          role: 'assistant',
          content: response.content || '',
          toolCalls: response.toolCalls.length > 0 ? JSON.stringify(response.toolCalls) : null,
          conversationId: conversation.id,
        },
      });

      // Save tool result messages to DB
      for (const tr of toolResults) {
        await prisma.message.create({
          data: {
            role: tr.role,
            content: tr.content,
            toolCallId: tr.toolCallId,
            conversationId: conversation.id,
          },
        });
      }

      // Get next response from LLM
      response = await this.llmService.chat(messages, tools as any);
      iterations++;
    }

    // Save assistant response
    await prisma.message.create({
      data: {
        role: 'assistant',
        content: response.content,
        conversationId: conversation.id,
      },
    });

    return {
      conversationId: conversation.id,
      content: response.content,
    };
  }
}
