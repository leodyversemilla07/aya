import { Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma, prisma } from '@workspace/db';
import { executeTool } from './agent/tools';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfToday(): Date {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

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

  async getStats() {
    const today = startOfToday();
    const inThirtyDays = new Date(today.getTime() + 30 * DAY_MS);
    const fourteenDaysAgo = new Date(today.getTime() - 14 * DAY_MS);

    const activeAssignment: Prisma.AssignmentWhereInput = {
      status: 'active',
      OR: [{ endDate: null }, { endDate: { gte: today } }],
    };

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
      prisma.contract.count({ where: { status: 'active', endDate: { gte: today } } }),
      prisma.contract.count({
        where: {
          status: { in: ['active', 'renewing'] },
          endDate: { gte: today, lte: inThirtyDays },
        },
      }),
      prisma.developer.count({
        where: {
          benchSince: { lte: fourteenDaysAgo },
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

  async getConversation(id: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation "${id}" was not found.`);
    }

    return {
      id: conversation.id,
      title: conversation.title?.trim() || 'Untitled conversation',
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages
        .filter(
          (message) =>
            (message.role === 'user' || message.role === 'assistant') &&
            message.content.trim().length > 0,
        )
        .map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt,
        })),
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
