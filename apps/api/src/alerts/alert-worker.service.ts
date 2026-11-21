import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { Inject, Injectable } from '@nestjs/common';
import { prisma } from '@workspace/db';
import { getServerEnv } from '@workspace/env';
import { type AlertScanSummary, AlertScannerService } from './alert-scanner.service';
import { type DeliveryRunSummary, WebhookDeliveryService } from './webhook-delivery.service';

const LEASE_NAME = 'staffing-alerts';

export interface AlertWorkerRunSummary {
  acquired: boolean;
  scan?: AlertScanSummary;
  delivery?: DeliveryRunSummary;
}

@Injectable()
export class AlertWorkerService {
  private readonly ownerId = `${hostname()}:${process.pid}:${randomUUID()}`;

  constructor(
    @Inject(AlertScannerService) private readonly scanner: AlertScannerService,
    @Inject(WebhookDeliveryService) private readonly deliveries: WebhookDeliveryService,
  ) {}

  async runOnce(now = new Date()): Promise<AlertWorkerRunSummary> {
    if (!(await this.acquireLease(now))) {
      return { acquired: false };
    }

    const startedAt = Date.now();
    let scan: AlertScanSummary | undefined;
    let delivery: DeliveryRunSummary | undefined;
    let workerError: unknown;

    try {
      try {
        scan = await this.scanner.scan(now);
      } catch (error) {
        workerError = error;
      }

      try {
        delivery = await this.deliveries.processPending(25, now);
      } catch (error) {
        workerError ??= error;
      }
    } finally {
      await this.releaseLease(new Date(), Date.now() - startedAt, scan?.durationMs, workerError);
    }

    if (workerError) throw workerError;
    return { acquired: true, scan, delivery };
  }

  private async acquireLease(now: Date): Promise<boolean> {
    const expiresAt = new Date(now.getTime() + getServerEnv().ALERT_LEASE_SECONDS * 1_000);
    const renewed = await prisma.workerLease.updateMany({
      where: {
        name: LEASE_NAME,
        OR: [{ expiresAt: { lte: now } }, { ownerId: this.ownerId }],
      },
      data: { ownerId: this.ownerId, expiresAt, updatedAt: now },
    });
    if (renewed.count === 1) return true;

    const inserted = await prisma.$executeRaw`
      INSERT INTO "WorkerLease"
        ("name", "ownerId", "expiresAt", "runCount", "createdAt", "updatedAt")
      VALUES (${LEASE_NAME}, ${this.ownerId}, ${expiresAt}, 0, ${now}, ${now})
      ON CONFLICT ("name") DO NOTHING
    `;
    return inserted === 1;
  }

  private async releaseLease(
    completedAt: Date,
    durationMs: number,
    scanDurationMs: number | undefined,
    error: unknown,
  ): Promise<void> {
    await prisma.workerLease.updateMany({
      where: { name: LEASE_NAME, ownerId: this.ownerId },
      data: {
        ownerId: null,
        expiresAt: completedAt,
        runCount: { increment: 1 },
        lastRunAt: completedAt,
        lastDurationMs: Math.max(0, durationMs),
        ...(scanDurationMs === undefined
          ? {}
          : { lastScanDurationMs: Math.max(0, scanDurationMs) }),
        ...(error ? {} : { lastSuccessAt: completedAt }),
        lastError: error
          ? (error instanceof Error ? error.message : String(error)).slice(0, 1_000)
          : null,
      },
    });
  }
}
