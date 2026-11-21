import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma, prisma } from '@workspace/db';
import type { z } from 'zod';
import type { AuthenticatedRequest } from '../auth/request';
import type { notificationListQuerySchema } from './notification.schemas';

type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;

@Injectable()
export class NotificationService {
  async list(userId: string, query: NotificationListQuery) {
    const where: Prisma.NotificationWhereInput = query.unreadOnly
      ? { reads: { none: { userId } } }
      : {};

    const [notifications, total, notificationCount, readCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          reads: { where: { userId }, select: { readAt: true } },
          alert: {
            select: {
              fingerprint: true,
              type: true,
              status: true,
              entityType: true,
              entityId: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: query.offset,
        take: query.limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count(),
      prisma.notificationRead.count({ where: { userId } }),
    ]);

    return {
      items: notifications.map((notification) => ({
        id: notification.id,
        event: notification.event,
        severity: notification.severity,
        title: notification.title,
        message: notification.message,
        read: notification.reads.length > 0,
        readAt: notification.reads[0]?.readAt ?? null,
        createdAt: notification.createdAt,
        alert: notification.alert,
      })),
      total,
      unreadTotal: Math.max(0, notificationCount - readCount),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async unreadCount(userId: string) {
    const [notificationCount, readCount] = await Promise.all([
      prisma.notification.count(),
      prisma.notificationRead.count({ where: { userId } }),
    ]);
    return { unread: Math.max(0, notificationCount - readCount) };
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: { id: true },
    });
    if (!notification) throw new NotFoundException('Notification not found.');

    const read = await prisma.notificationRead.upsert({
      where: { notificationId_userId: { notificationId, userId } },
      create: { notificationId, userId },
      update: { readAt: new Date() },
    });
    return { id: read.notificationId, read: true, readAt: read.readAt };
  }

  async markAllRead(userId: string) {
    const notifications = await prisma.notification.findMany({
      where: { reads: { none: { userId } } },
      select: { id: true },
    });
    const now = new Date();
    await prisma.$transaction(
      notifications.map((notification) =>
        prisma.notificationRead.upsert({
          where: { notificationId_userId: { notificationId: notification.id, userId } },
          create: { notificationId: notification.id, userId, readAt: now },
          update: { readAt: now },
        }),
      ),
    );
    const unread = await this.unreadCount(userId);
    return { markedRead: notifications.length, unread: unread.unread };
  }

  userIdFromRequest(request: AuthenticatedRequest): string {
    const userId = request.auth?.user?.id;
    if (typeof userId !== 'string' || userId.length === 0) {
      throw new ForbiddenException('Notifications require a signed-in workspace user.');
    }
    return userId;
  }
}
