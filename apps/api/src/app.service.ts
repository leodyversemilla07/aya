import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { type Prisma, prisma } from '@workspace/db';
import { executeTool } from './agent/tools';
import { addDays, occupiedAssignmentWhere, startOfToday } from './domain/staffing';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getHealth() {
    return {
      status: 'ok',
      service: 'aya-api',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness() {
    try {
      // A real model query verifies that the database is reachable and that
      // the expected schema has actually been applied.
      await prisma.developer.findFirst({ select: { id: true } });
    } catch {
      throw new ServiceUnavailableException('The database is not ready.');
    }

    return {
      status: 'ready',
      service: 'aya-api',
      timestamp: new Date().toISOString(),
    };
  }

  async getStats() {
    const today = startOfToday();
    const inThirtyDays = addDays(today, 30);
    const activeAssignment = occupiedAssignmentWhere(today);

    const [
      developers,
      clients,
      assigned,
      activeContracts,
      expiringContracts,
      benchOver14Days,
      conversations,
      alerts,
    ] = await Promise.all([
      prisma.developer.count(),
      prisma.client.count(),
      prisma.developer.count({ where: { assignments: { some: activeAssignment } } }),
      prisma.contract.count({
        where: { status: 'active', startDate: { lte: today }, endDate: { gte: today } },
      }),
      prisma.contract.count({
        where: {
          status: { in: ['active', 'renewing'] },
          startDate: { lte: today },
          endDate: { gte: today, lte: inThirtyDays },
        },
      }),
      prisma.developer.count({
        where: {
          benchSince: { lt: addDays(today, -14) },
          assignments: { none: activeAssignment },
        },
      }),
      prisma.conversation.count(),
      // Reuse the agent's alert logic so the dashboard headline matches the
      // alerts the assistant reports.
      executeTool('get_alerts', { type: 'all' }),
    ]);

    const onBench = Math.max(developers - assigned, 0);
    const openAlerts = Array.isArray(alerts) ? alerts.length : 0;

    return {
      developers,
      onBench,
      assigned,
      clients,
      activeContracts,
      expiringContracts,
      openAlerts,
      benchOver14Days,
      conversations,
      utilizationRate: developers > 0 ? Math.round((assigned / developers) * 100) : 0,
      updatedAt: new Date().toISOString(),
    };
  }

  async listConversations() {
    const conversations = await prisma.conversation.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { role: true, content: true, createdAt: true },
        },
        _count: { select: { messages: true } },
      },
    });

    return conversations.map((conversation) => {
      // Prefer the earliest recent user message so the sidebar preview shows
      // what the conversation was about, not just the latest assistant reply.
      const previewMessage =
        [...conversation.messages].reverse().find((message) => message.role === 'user') ??
        conversation.messages.find((message) => message.content.trim().length > 0);

      return {
        id: conversation.id,
        title: conversation.title?.trim() || 'Untitled conversation',
        preview: previewMessage?.content.replace(/\s+/g, ' ').slice(0, 120) ?? '',
        messageCount: conversation._count.messages,
        lastMessageAt: conversation.messages[0]?.createdAt ?? conversation.updatedAt,
        updatedAt: conversation.updatedAt,
      };
    });
  }

  async getConversation(id: string, options: { limit?: number; before?: string } = {}) {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation "${id}" was not found.`);
    }

    const limit = options.limit ?? 100;
    const messageWhere: Prisma.MessageWhereInput = {
      conversationId: id,
      role: { in: ['user', 'assistant'] },
      content: { not: '' },
    };

    if (options.before) {
      const cursor = await prisma.message.findUnique({
        where: { id: options.before },
        select: { createdAt: true, id: true, conversationId: true },
      });
      if (!cursor || cursor.conversationId !== id) {
        throw new NotFoundException(`Message "${options.before}" was not found.`);
      }
      messageWhere.AND = [
        {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        },
      ];
    }

    const storedMessages = await prisma.message.findMany({
      where: messageWhere,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasMore = storedMessages.length > limit;
    const page = storedMessages.slice(0, limit);
    const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

    return {
      id: conversation.id,
      title: conversation.title?.trim() || 'Untitled conversation',
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: [...page]
        .reverse()
        .filter((message) => message.content.trim().length > 0)
        .map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt,
        })),
      hasMore,
      nextCursor,
    };
  }

  async deleteConversation(id: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation "${id}" was not found.`);
    }

    await prisma.conversation.delete({ where: { id } });
    return { deleted: true, id };
  }
}
