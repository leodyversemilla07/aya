import { Injectable } from '@nestjs/common';
import { type Prisma, prisma } from '@workspace/db';
import { z } from 'zod';
import { type alertDeliveryListQuerySchema, type alertListQuerySchema } from './alert.schemas';

type AlertListQuery = z.infer<typeof alertListQuerySchema>;
type AlertDeliveryListQuery = z.infer<typeof alertDeliveryListQuerySchema>;

@Injectable()
export class AlertService {
  async listAlerts(query: AlertListQuery) {
    const where: Prisma.StaffingAlertWhereInput = {
      ...(query.status === 'all' ? {} : { status: query.status }),
      ...(query.type === 'all' ? {} : { type: query.type }),
      ...(query.severity === 'all' ? {} : { severity: query.severity }),
    };
    const [alerts, total] = await Promise.all([
      prisma.staffingAlert.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: query.offset,
        take: query.limit,
      }),
      prisma.staffingAlert.count({ where }),
    ]);

    return {
      items: alerts.map((alert) => ({
        id: alert.id,
        fingerprint: alert.fingerprint,
        type: alert.type,
        severity: alert.severity,
        status: alert.status,
        entityType: alert.entityType,
        entityId: alert.entityId,
        message: alert.message,
        data: this.parseData(alert.data),
        firstSeenAt: alert.firstSeenAt,
        lastSeenAt: alert.lastSeenAt,
        resolvedAt: alert.resolvedAt,
        lastEventAt: alert.lastEventAt,
        createdAt: alert.createdAt,
        updatedAt: alert.updatedAt,
      })),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async listDeliveries(query: AlertDeliveryListQuery) {
    const where: Prisma.AlertDeliveryWhereInput = {
      ...(query.status === 'all' ? {} : { status: query.status }),
      ...(query.event === 'all' ? {} : { event: query.event }),
    };
    const [deliveries, total] = await Promise.all([
      prisma.alertDelivery.findMany({
        where,
        include: {
          alert: {
            select: {
              id: true,
              fingerprint: true,
              type: true,
              severity: true,
              status: true,
              entityType: true,
              entityId: true,
              message: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: query.offset,
        take: query.limit,
      }),
      prisma.alertDelivery.count({ where }),
    ]);

    return {
      items: deliveries.map((delivery) => ({
        id: delivery.id,
        alertId: delivery.alertId,
        event: delivery.event,
        snapshot: this.parseData(delivery.snapshot),
        status: delivery.status,
        destination: this.redactDestination(delivery.destination),
        attemptCount: delivery.attemptCount,
        nextAttemptAt: delivery.nextAttemptAt,
        lastError: delivery.lastError,
        responseStatus: delivery.responseStatus,
        deliveredAt: delivery.deliveredAt,
        createdAt: delivery.createdAt,
        updatedAt: delivery.updatedAt,
        alert: delivery.alert,
      })),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  private redactDestination(value: string | null): string | null {
    if (!value) return null;
    try {
      const url = new URL(value);
      return `${url.origin}${url.pathname}`;
    } catch {
      return '[configured]';
    }
  }

  private parseData(value: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
}
