import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { prisma } from '@workspace/db';
import { getServerEnv } from '@workspace/env';
import type { AlertEventSnapshot } from './alert-scanner.service';

export interface DeliveryRunSummary {
  claimed: number;
  delivered: number;
  failed: number;
  skipped: number;
}

function retryDelayMs(attempt: number): number {
  return Math.min(5_000 * 2 ** Math.max(0, attempt - 1), 60 * 60_000);
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1_000);
}

@Injectable()
export class WebhookDeliveryService {
  async processPending(limit = 25, now = new Date()): Promise<DeliveryRunSummary> {
    const env = getServerEnv();
    const summary: DeliveryRunSummary = { claimed: 0, delivered: 0, failed: 0, skipped: 0 };

    if (!env.ALERT_WEBHOOK_URL || !env.ALERT_WEBHOOK_SECRET) {
      return summary;
    }

    const staleBefore = new Date(now.getTime() - env.ALERT_WEBHOOK_TIMEOUT_MS * 2);
    const candidates = await prisma.alertDelivery.findMany({
      where: {
        attemptCount: { lt: env.ALERT_WEBHOOK_MAX_ATTEMPTS },
        OR: [
          {
            status: { in: ['pending', 'failed'] },
            nextAttemptAt: { lte: now },
          },
          {
            status: 'processing',
            updatedAt: { lte: staleBefore },
          },
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: Math.max(1, Math.min(limit, 100)),
    });

    for (const candidate of candidates) {
      const destination = candidate.destination ?? env.ALERT_WEBHOOK_URL;
      const claimed = await prisma.alertDelivery.updateMany({
        where: {
          id: candidate.id,
          attemptCount: { lt: env.ALERT_WEBHOOK_MAX_ATTEMPTS },
          OR: [
            {
              status: { in: ['pending', 'failed'] },
              nextAttemptAt: { lte: now },
            },
            {
              status: 'processing',
              updatedAt: { lte: staleBefore },
            },
          ],
        },
        data: {
          status: 'processing',
          destination,
          attemptCount: { increment: 1 },
          updatedAt: now,
        },
      });

      if (claimed.count !== 1) {
        summary.skipped++;
        continue;
      }

      summary.claimed++;
      const delivery = await prisma.alertDelivery.findUnique({
        where: { id: candidate.id },
        include: { alert: true },
      });
      if (!delivery) {
        summary.skipped++;
        continue;
      }

      const body = JSON.stringify({
        id: delivery.id,
        event: delivery.event,
        occurredAt: delivery.createdAt.toISOString(),
        alert: this.parseSnapshot(delivery.snapshot, delivery.alert),
      });
      const signature = createHmac('sha256', env.ALERT_WEBHOOK_SECRET).update(body).digest('hex');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), env.ALERT_WEBHOOK_TIMEOUT_MS);
      let responseStatus: number | undefined;

      try {
        const response = await fetch(destination, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'user-agent': 'aya-alert-worker/1.0',
            'x-aya-delivery-id': delivery.id,
            'x-aya-event': delivery.event,
            'x-aya-signature': `sha256=${signature}`,
          },
          body,
          signal: controller.signal,
        });

        responseStatus = response.status;
        if (!response.ok) {
          throw new Error(`Webhook responded with HTTP ${response.status}`);
        }

        await prisma.alertDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'succeeded',
            responseStatus: response.status,
            deliveredAt: new Date(),
            lastError: null,
          },
        });
        summary.delivered++;
      } catch (error) {
        const attemptCount = delivery.attemptCount;
        await prisma.alertDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'failed',
            responseStatus,
            lastError: safeErrorMessage(error),
            nextAttemptAt: new Date(now.getTime() + retryDelayMs(attemptCount)),
          },
        });
        summary.failed++;
      } finally {
        clearTimeout(timeout);
      }
    }

    return summary;
  }

  private parseSnapshot(
    value: string,
    fallback: {
      id: string;
      fingerprint: string;
      type: string;
      severity: string;
      status: string;
      entityType: string;
      entityId: string;
      message: string;
      data: string;
      firstSeenAt: Date;
      lastSeenAt: Date;
      resolvedAt: Date | null;
      lastEventAt: Date | null;
    },
  ): AlertEventSnapshot {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as AlertEventSnapshot;
      }
    } catch {
      // Fall through to the current alert state for legacy or malformed rows.
    }

    return {
      id: fallback.id,
      fingerprint: fallback.fingerprint,
      type: fallback.type,
      severity: fallback.severity,
      status: fallback.status,
      entityType: fallback.entityType,
      entityId: fallback.entityId,
      message: fallback.message,
      data: this.parseData(fallback.data),
      firstSeenAt: fallback.firstSeenAt.toISOString(),
      lastSeenAt: fallback.lastSeenAt.toISOString(),
      resolvedAt: fallback.resolvedAt?.toISOString() ?? null,
      lastEventAt: fallback.lastEventAt?.toISOString() ?? null,
    };
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
