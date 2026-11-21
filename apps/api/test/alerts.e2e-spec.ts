import { createHmac } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { prisma } from '@workspace/db';
import request from 'supertest';
import type { App } from 'supertest/types';
import { queryStaffingAlerts } from '../src/alerts/alert-query';
import { AlertScannerService } from '../src/alerts/alert-scanner.service';
import { AlertWorkerService } from '../src/alerts/alert-worker.service';
import { WebhookDeliveryService } from '../src/alerts/webhook-delivery.service';
import { AppModule } from '../src/app.module';
import type { AuthenticatedRequest } from '../src/auth/request';
import { NotificationService } from '../src/notifications/notification.service';

function atUtcMidnight(date = new Date()): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

describe('Background staffing alerts (e2e)', () => {
  let app: INestApplication<App>;
  let scanner: AlertScannerService;
  let deliveries: WebhookDeliveryService;
  let worker: AlertWorkerService;
  let notifications: NotificationService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    scanner = app.get(AlertScannerService);
    deliveries = app.get(WebhookDeliveryService);
    worker = app.get(AlertWorkerService);
    notifications = app.get(NotificationService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('deduplicates, updates, resolves, and reopens one durable alert', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const today = atUtcMidnight();
    const developer = await prisma.developer.create({
      data: {
        name: `Alert Developer ${suffix}`,
        email: `alert-${suffix}@example.com`,
        role: 'Backend Engineer',
        seniority: 'senior',
      },
    });
    const client = await prisma.client.create({
      data: { name: `Alert Client ${suffix}`, industry: 'technology' },
    });
    const contract = await prisma.contract.create({
      data: {
        developerId: developer.id,
        clientId: client.id,
        startDate: addDays(today, -60),
        endDate: addDays(today, 10),
        billingRate: 100,
        status: 'active',
      },
    });
    const fingerprint = `contract:${contract.id}`;
    const user = await prisma.user.create({
      data: {
        id: `alert-test-${suffix}`,
        name: 'Alert Test User',
        email: `alert-user-${suffix}@example.com`,
        emailVerified: true,
        role: 'viewer',
      },
    });

    try {
      const liveAlerts = await queryStaffingAlerts('all', today);
      expect(liveAlerts.find((alert) => alert.fingerprint === fingerprint)).toMatchObject({
        type: 'contract',
        severity: 'medium',
        entityId: contract.id,
      });

      await scanner.scan();
      const opened = await prisma.staffingAlert.findUnique({ where: { fingerprint } });
      expect(opened).toMatchObject({ status: 'open', severity: 'medium', entityId: contract.id });
      expect(
        await prisma.alertDelivery.count({
          where: { alertId: opened!.id, event: 'opened' },
        }),
      ).toBe(1);

      const notification = await prisma.notification.findFirst({
        where: { alertId: opened!.id, event: 'opened' },
      });
      expect(notification).toMatchObject({
        title: 'Staffing alert opened',
        severity: 'medium',
      });
      const sessionRequest = {
        auth: { user: { id: user.id } },
      } as unknown as AuthenticatedRequest;
      const beforeRead = await notifications.list(user.id, {
        unreadOnly: false,
        limit: 50,
        offset: 0,
      });
      expect(beforeRead.items.find((item) => item.id === notification?.id)?.read).toBe(false);
      await notifications.markRead(user.id, notification!.id);
      const afterRead = await notifications.list(user.id, {
        unreadOnly: true,
        limit: 50,
        offset: 0,
      });
      expect(afterRead.items.find((item) => item.id === notification?.id)).toBeUndefined();
      await notifications.markAllRead(user.id);
      await expect(notifications.unreadCount(user.id)).resolves.toEqual({ unread: 0 });

      await scanner.scan();
      expect(
        await prisma.alertDelivery.count({
          where: { alertId: opened!.id, event: 'opened' },
        }),
      ).toBe(1);

      await prisma.contract.update({
        where: { id: contract.id },
        data: { endDate: addDays(today, 3) },
      });
      await scanner.scan();
      const escalated = await prisma.staffingAlert.findUnique({ where: { fingerprint } });
      expect(escalated).toMatchObject({ status: 'open', severity: 'high' });
      expect(
        await prisma.alertDelivery.count({
          where: { alertId: opened!.id, event: 'updated' },
        }),
      ).toBe(1);

      await prisma.contract.update({
        where: { id: contract.id },
        data: { endDate: addDays(today, 40) },
      });
      await scanner.scan();
      const resolved = await prisma.staffingAlert.findUnique({ where: { fingerprint } });
      expect(resolved).toMatchObject({ status: 'resolved' });
      expect(resolved?.resolvedAt).toBeInstanceOf(Date);
      expect(
        await prisma.alertDelivery.count({
          where: { alertId: opened!.id, event: 'resolved' },
        }),
      ).toBe(1);

      await prisma.contract.update({
        where: { id: contract.id },
        data: { endDate: addDays(today, 10) },
      });
      await scanner.scan();
      const reopened = await prisma.staffingAlert.findUnique({ where: { fingerprint } });
      expect(reopened).toMatchObject({ status: 'open', severity: 'medium', resolvedAt: null });
      expect(
        await prisma.alertDelivery.count({
          where: { alertId: opened!.id, event: 'reopened' },
        }),
      ).toBe(1);
      expect(await prisma.alertDelivery.count({ where: { alertId: opened!.id } })).toBe(4);

      const deliveries = await prisma.alertDelivery.findMany({
        where: { alertId: opened!.id },
        orderBy: { createdAt: 'asc' },
      });
      const snapshotFor = (event: string) =>
        JSON.parse(deliveries.find((delivery) => delivery.event === event)?.snapshot ?? '{}');
      expect(snapshotFor('opened')).toMatchObject({ status: 'open', severity: 'medium' });
      expect(snapshotFor('updated')).toMatchObject({ status: 'open', severity: 'high' });
      expect(snapshotFor('resolved')).toMatchObject({ status: 'resolved', severity: 'high' });
      expect(snapshotFor('reopened')).toMatchObject({ status: 'open', severity: 'medium' });
    } finally {
      await prisma.staffingAlert.deleteMany({ where: { fingerprint } });
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.contract.delete({ where: { id: contract.id } });
      await prisma.developer.delete({ where: { id: developer.id } });
      await prisma.client.delete({ where: { id: client.id } });
    }
  });

  it('signs, delivers, and safely retries webhook events', async () => {
    const previousUrl = process.env.ALERT_WEBHOOK_URL;
    const previousSecret = process.env.ALERT_WEBHOOK_SECRET;
    const url = 'https://alerts.example.test/aya';
    const secret = 'test-webhook-secret-12345';
    process.env.ALERT_WEBHOOK_URL = url;
    process.env.ALERT_WEBHOOK_SECRET = secret;

    await prisma.alertDelivery.deleteMany();
    await prisma.staffingAlert.deleteMany();

    const alert = await prisma.staffingAlert.create({
      data: {
        fingerprint: 'test:webhook',
        type: 'contract',
        severity: 'high',
        status: 'open',
        entityType: 'contract',
        entityId: 'contract-test',
        message: 'Contract expires soon',
        data: JSON.stringify({ daysLeft: 3 }),
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        lastEventAt: new Date(),
      },
    });
    const delivery = await prisma.alertDelivery.create({
      data: {
        alertId: alert.id,
        event: 'opened',
        snapshot: JSON.stringify({
          id: alert.id,
          fingerprint: alert.fingerprint,
          type: alert.type,
          severity: alert.severity,
          status: alert.status,
          entityType: alert.entityType,
          entityId: alert.entityId,
          message: alert.message,
          data: { daysLeft: 3 },
          firstSeenAt: alert.firstSeenAt.toISOString(),
          lastSeenAt: alert.lastSeenAt.toISOString(),
          resolvedAt: null,
          lastEventAt: alert.lastEventAt?.toISOString() ?? null,
        }),
        status: 'pending',
        destination: null,
        nextAttemptAt: new Date(Date.now() - 1_000),
      },
    });

    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    try {
      const concurrentResults = await Promise.all([
        deliveries.processPending(10, new Date()),
        deliveries.processPending(10, new Date()),
      ]);
      const claimedResult = concurrentResults.find((result) => result.claimed === 1);
      const skippedResult = concurrentResults.find((result) => result.claimed === 0);
      expect(claimedResult).toMatchObject({ claimed: 1, delivered: 0, failed: 1 });
      expect(skippedResult).toMatchObject({ claimed: 0, delivered: 0, failed: 0 });
      expect(skippedResult?.skipped).toBeGreaterThanOrEqual(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const failed = await prisma.alertDelivery.findUnique({ where: { id: delivery.id } });
      expect(failed).toMatchObject({ status: 'failed', attemptCount: 1, responseStatus: 500 });

      const second = await deliveries.processPending(10, new Date(Date.now() + 6_000));
      expect(second).toMatchObject({ claimed: 1, delivered: 1, failed: 0 });
      const succeeded = await prisma.alertDelivery.findUnique({ where: { id: delivery.id } });
      expect(succeeded).toMatchObject({
        status: 'succeeded',
        attemptCount: 2,
        responseStatus: 204,
      });
      expect(succeeded?.deliveredAt).toBeInstanceOf(Date);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const successfulCall = fetchMock.mock.calls[1];
      expect(successfulCall[0]).toBe(url);
      const body = String(successfulCall[1]?.body);
      const expectedSignature = createHmac('sha256', secret).update(body).digest('hex');
      expect(successfulCall[1]?.headers).toMatchObject({
        'x-aya-delivery-id': delivery.id,
        'x-aya-event': 'opened',
        'x-aya-signature': `sha256=${expectedSignature}`,
      });
      expect(JSON.parse(body)).toMatchObject({
        id: delivery.id,
        event: 'opened',
        alert: { fingerprint: 'test:webhook', severity: 'high' },
      });
    } finally {
      fetchMock.mockRestore();
      if (previousUrl === undefined) Reflect.deleteProperty(process.env, 'ALERT_WEBHOOK_URL');
      else process.env.ALERT_WEBHOOK_URL = previousUrl;
      if (previousSecret === undefined) Reflect.deleteProperty(process.env, 'ALERT_WEBHOOK_SECRET');
      else process.env.ALERT_WEBHOOK_SECRET = previousSecret;
      await prisma.alertDelivery.deleteMany();
      await prisma.staffingAlert.deleteMany();
    }
  });

  it('uses a database lease so only one worker can run an iteration', async () => {
    await prisma.workerLease.upsert({
      where: { name: 'staffing-alerts' },
      create: {
        name: 'staffing-alerts',
        ownerId: 'another-worker',
        expiresAt: new Date(Date.now() + 60_000),
        runCount: 0,
      },
      update: {
        ownerId: 'another-worker',
        expiresAt: new Date(Date.now() + 60_000),
        runCount: 0,
      },
    });

    try {
      await expect(worker.runOnce()).resolves.toEqual({ acquired: false });
    } finally {
      await prisma.workerLease.deleteMany({ where: { name: 'staffing-alerts' } });
    }

    await expect(worker.runOnce()).resolves.toMatchObject({ acquired: true });
    const completedLease = await prisma.workerLease.findUnique({
      where: { name: 'staffing-alerts' },
    });
    expect(completedLease).toMatchObject({ runCount: 1, ownerId: null });
    expect(completedLease?.lastRunAt).toBeInstanceOf(Date);
    expect(completedLease?.lastSuccessAt).toBeInstanceOf(Date);
    expect(completedLease?.lastScanDurationMs).toEqual(expect.any(Number));
  });

  it('exposes alert state and admin delivery history', async () => {
    await request(app.getHttpServer()).get('/alerts').expect(401);
    const alerts = await request(app.getHttpServer())
      .get('/alerts')
      .set('x-api-key', 'test-api-key')
      .expect(200);
    expect(alerts.body).toMatchObject({ total: expect.any(Number), items: expect.any(Array) });

    const history = await request(app.getHttpServer())
      .get('/alerts/deliveries')
      .set('x-api-key', 'test-api-key')
      .expect(200);
    expect(history.body).toMatchObject({ total: expect.any(Number), items: expect.any(Array) });

    await request(app.getHttpServer())
      .get('/notifications')
      .set('x-api-key', 'test-api-key')
      .expect(403);

    const config = await request(app.getHttpServer())
      .get('/admin/alerts/config')
      .set('x-api-key', 'test-api-key')
      .expect(200);
    expect(config.body).toMatchObject({
      webhook: { configured: false, secretConfigured: false },
      rules: { bench: { minimumDays: 14 }, contract: { expiringDays: 30 } },
    });

    const scan = await request(app.getHttpServer())
      .post('/admin/alerts/scan')
      .set('x-api-key', 'test-api-key')
      .expect(201);
    expect(scan.body).toMatchObject({
      scannedAt: expect.any(String),
      current: expect.any(Number),
      opened: expect.any(Number),
    });
    const scanAudit = await request(app.getHttpServer())
      .get('/admin/audit-logs?action=scan&limit=10')
      .set('x-api-key', 'test-api-key')
      .expect(200);
    expect(scanAudit.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'scan',
          entityType: 'staffing-alert-scan',
          actorType: 'api-key',
        }),
      ]),
    );

    await request(app.getHttpServer()).get('/metrics').expect(401);
    const metrics = await request(app.getHttpServer())
      .get('/metrics')
      .set('x-metrics-token', 'test-metrics-token-123456')
      .expect(200);
    expect(metrics.headers['content-type']).toContain('text/plain');
    expect(metrics.text).toContain('aya_alert_worker_runs_total');
    expect(metrics.text).toContain('aya_alert_transitions_total{event="opened"}');
    expect(metrics.text).toContain('aya_alert_webhook_attempts_total');
    expect(metrics.text).toContain('aya_alert_scan_last_duration_seconds');
  });
});
