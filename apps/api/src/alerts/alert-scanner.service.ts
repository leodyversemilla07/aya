import { Injectable } from '@nestjs/common';
import { type Prisma, prisma } from '@workspace/db';
import { getServerEnv } from '@workspace/env';
import { type AuditActor, writeAudit } from '../audit/audit';
import { startOfToday } from '../domain/staffing';
import { type ComputedStaffingAlert, queryStaffingAlerts } from './alert-query';

export type AlertLifecycleEvent = 'opened' | 'updated' | 'reopened' | 'resolved';

export interface AlertScanSummary {
  current: number;
  opened: number;
  updated: number;
  reopened: number;
  resolved: number;
  unchanged: number;
  durationMs: number;
}

export interface AlertScanOptions {
  actor?: AuditActor;
  requestId?: string;
}

export interface AlertEventSnapshot {
  id: string;
  fingerprint: string;
  type: string;
  severity: string;
  status: string;
  entityType: string;
  entityId: string;
  message: string;
  data: Record<string, unknown>;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  lastEventAt: string | null;
}

function parseData(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function snapshotFrom(alert: {
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
}): AlertEventSnapshot {
  return {
    id: alert.id,
    fingerprint: alert.fingerprint,
    type: alert.type,
    severity: alert.severity,
    status: alert.status,
    entityType: alert.entityType,
    entityId: alert.entityId,
    message: alert.message,
    data: parseData(alert.data),
    firstSeenAt: alert.firstSeenAt.toISOString(),
    lastSeenAt: alert.lastSeenAt.toISOString(),
    resolvedAt: alert.resolvedAt?.toISOString() ?? null,
    lastEventAt: alert.lastEventAt?.toISOString() ?? null,
  };
}

const notificationTitles: Record<AlertLifecycleEvent, string> = {
  opened: 'Staffing alert opened',
  updated: 'Staffing alert updated',
  reopened: 'Staffing alert reopened',
  resolved: 'Staffing alert resolved',
};

async function createDelivery(
  tx: Prisma.TransactionClient,
  alertId: string,
  event: AlertLifecycleEvent,
  snapshot: AlertEventSnapshot,
  destination: string | undefined,
  now: Date,
): Promise<void> {
  const delivery = await tx.alertDelivery.create({
    data: {
      alertId,
      event,
      snapshot: JSON.stringify(snapshot),
      status: 'pending',
      destination: destination ?? null,
      nextAttemptAt: now,
    },
  });
  await tx.notification.create({
    data: {
      alertId,
      deliveryId: delivery.id,
      event,
      severity: snapshot.severity,
      title: notificationTitles[event],
      message: snapshot.message,
      createdAt: now,
    },
  });
}

@Injectable()
export class AlertScannerService {
  async scan(now = new Date(), options: AlertScanOptions = {}): Promise<AlertScanSummary> {
    const startedAt = Date.now();
    const computed = await queryStaffingAlerts('all', startOfToday(now));
    const destination = getServerEnv().ALERT_WEBHOOK_URL;
    const currentFingerprints = new Set(computed.map((alert) => alert.fingerprint));

    const summary = await prisma.$transaction(
      async (tx) => {
        const summary: AlertScanSummary = {
          current: computed.length,
          opened: 0,
          updated: 0,
          reopened: 0,
          resolved: 0,
          unchanged: 0,
          durationMs: 0,
        };

        for (const alert of computed) {
          const existing = await tx.staffingAlert.findUnique({
            where: { fingerprint: alert.fingerprint },
          });

          if (!existing) {
            const created = await tx.staffingAlert.create({
              data: {
                fingerprint: alert.fingerprint,
                type: alert.type,
                severity: alert.severity,
                status: 'open',
                entityType: alert.entityType,
                entityId: alert.entityId,
                message: alert.message,
                data: JSON.stringify(alert.data),
                firstSeenAt: now,
                lastSeenAt: now,
                lastEventAt: now,
              },
            });
            await createDelivery(tx, created.id, 'opened', snapshotFrom(created), destination, now);
            summary.opened++;
            continue;
          }

          if (existing.status === 'resolved') {
            const reopened = await tx.staffingAlert.update({
              where: { id: existing.id },
              data: {
                status: 'open',
                severity: alert.severity,
                message: alert.message,
                data: JSON.stringify(alert.data),
                lastSeenAt: now,
                resolvedAt: null,
                lastEventAt: now,
              },
            });
            await createDelivery(
              tx,
              reopened.id,
              'reopened',
              snapshotFrom(reopened),
              destination,
              now,
            );
            summary.reopened++;
            continue;
          }

          const severityChanged = existing.severity !== alert.severity;
          const needsOpeningDelivery = !existing.lastEventAt;
          const event: AlertLifecycleEvent | undefined = needsOpeningDelivery
            ? 'opened'
            : severityChanged
              ? 'updated'
              : undefined;

          const updated = await tx.staffingAlert.update({
            where: { id: existing.id },
            data: {
              severity: alert.severity,
              message: alert.message,
              data: JSON.stringify(alert.data),
              lastSeenAt: now,
              ...(event ? { lastEventAt: now } : {}),
            },
          });

          if (event) {
            await createDelivery(tx, existing.id, event, snapshotFrom(updated), destination, now);
            if (event === 'opened') summary.opened++;
            if (event === 'updated') summary.updated++;
          } else {
            summary.unchanged++;
          }
        }

        const openAlerts = await tx.staffingAlert.findMany({ where: { status: 'open' } });
        for (const alert of openAlerts) {
          if (currentFingerprints.has(alert.fingerprint)) continue;
          const resolved = await tx.staffingAlert.update({
            where: { id: alert.id },
            data: {
              status: 'resolved',
              resolvedAt: now,
              lastEventAt: now,
            },
          });
          await createDelivery(tx, alert.id, 'resolved', snapshotFrom(resolved), destination, now);
          summary.resolved++;
        }

        summary.durationMs = Date.now() - startedAt;
        if (options.actor) {
          await writeAudit(tx, options.actor, {
            action: 'scan',
            entityType: 'staffing-alert-scan',
            entityId: now.toISOString(),
            after: summary,
            requestId: options.requestId,
          });
        }

        return summary;
      },
      { maxWait: 5_000, timeout: 30_000 },
    );
    summary.durationMs = Date.now() - startedAt;
    return summary;
  }
}

export type { ComputedStaffingAlert };
