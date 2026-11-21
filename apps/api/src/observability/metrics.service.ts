import { Injectable } from '@nestjs/common';
import { prisma } from '@workspace/db';

function metricHeader(name: string, help: string, type: 'counter' | 'gauge'): string {
  return `# HELP ${name} ${help}\n# TYPE ${name} ${type}\n`;
}

function metric(name: string, value: number, labels = ''): string {
  return `${name}${labels} ${value}\n`;
}

@Injectable()
export class MetricsService {
  async render(now = new Date()): Promise<string> {
    const [
      lease,
      transitions,
      deliveryStatuses,
      attempts,
      notificationCount,
      notificationReadCount,
      openAlerts,
      resolvedAlerts,
    ] = await Promise.all([
      prisma.workerLease.findUnique({ where: { name: 'staffing-alerts' } }),
      prisma.alertDelivery.groupBy({ by: ['event'], _count: { _all: true } }),
      prisma.alertDelivery.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.alertDelivery.aggregate({ _sum: { attemptCount: true } }),
      prisma.notification.count(),
      prisma.notificationRead.count(),
      prisma.staffingAlert.count({ where: { status: 'open' } }),
      prisma.staffingAlert.count({ where: { status: 'resolved' } }),
    ]);

    const transitionCounts = new Map(transitions.map((row) => [row.event, row._count._all]));
    const deliveryCounts = new Map(deliveryStatuses.map((row) => [row.status, row._count._all]));
    const workerLagSeconds = lease?.lastRunAt
      ? Math.max(0, (now.getTime() - lease.lastRunAt.getTime()) / 1_000)
      : 0;

    let output = '';
    output += metricHeader(
      'aya_alert_worker_runs_total',
      'Completed background alert worker iterations.',
      'counter',
    );
    output += metric('aya_alert_worker_runs_total', lease?.runCount ?? 0);
    output += metricHeader(
      'aya_alert_worker_last_run_timestamp_seconds',
      'Unix timestamp of the last completed worker iteration.',
      'gauge',
    );
    output += metric(
      'aya_alert_worker_last_run_timestamp_seconds',
      lease?.lastRunAt ? lease.lastRunAt.getTime() / 1_000 : 0,
    );
    output += metricHeader(
      'aya_alert_worker_last_success_timestamp_seconds',
      'Unix timestamp of the last fully successful worker iteration.',
      'gauge',
    );
    output += metric(
      'aya_alert_worker_last_success_timestamp_seconds',
      lease?.lastSuccessAt ? lease.lastSuccessAt.getTime() / 1_000 : 0,
    );
    output += metricHeader(
      'aya_alert_worker_lag_seconds',
      'Seconds since the last completed worker iteration.',
      'gauge',
    );
    output += metric('aya_alert_worker_lag_seconds', workerLagSeconds);
    output += metricHeader(
      'aya_alert_worker_last_duration_seconds',
      'Duration of the last worker iteration in seconds.',
      'gauge',
    );
    output += metric(
      'aya_alert_worker_last_duration_seconds',
      (lease?.lastDurationMs ?? 0) / 1_000,
    );
    output += metricHeader(
      'aya_alert_scan_last_duration_seconds',
      'Duration of the last staffing alert scan in seconds.',
      'gauge',
    );
    output += metric(
      'aya_alert_scan_last_duration_seconds',
      (lease?.lastScanDurationMs ?? 0) / 1_000,
    );
    output += metricHeader(
      'aya_alert_worker_last_error',
      'Whether the last worker iteration ended with an unhandled error.',
      'gauge',
    );
    output += metric('aya_alert_worker_last_error', lease?.lastError ? 1 : 0);

    output += metricHeader(
      'aya_alert_transitions_total',
      'Staffing alert lifecycle transitions recorded by event.',
      'counter',
    );
    for (const event of ['opened', 'updated', 'reopened', 'resolved']) {
      output += metric(
        'aya_alert_transitions_total',
        transitionCounts.get(event) ?? 0,
        `{event="${event}"}`,
      );
    }

    output += metricHeader(
      'aya_alert_webhook_delivery_status',
      'Webhook delivery rows by current status.',
      'gauge',
    );
    for (const status of ['pending', 'processing', 'succeeded', 'failed']) {
      output += metric(
        'aya_alert_webhook_delivery_status',
        deliveryCounts.get(status) ?? 0,
        `{status="${status}"}`,
      );
    }
    output += metricHeader(
      'aya_alert_webhook_attempts_total',
      'Webhook delivery attempts recorded across all events.',
      'counter',
    );
    output += metric('aya_alert_webhook_attempts_total', attempts._sum.attemptCount ?? 0);
    output += metricHeader(
      'aya_alert_notifications_created_total',
      'In-app staffing notifications created.',
      'counter',
    );
    output += metric('aya_alert_notifications_created_total', notificationCount);
    output += metricHeader(
      'aya_alert_notifications_read_total',
      'Per-user in-app notification read records.',
      'counter',
    );
    output += metric('aya_alert_notifications_read_total', notificationReadCount);
    output += metricHeader(
      'aya_alert_open_states',
      'Staffing alerts currently in the open state.',
      'gauge',
    );
    output += metric('aya_alert_open_states', openAlerts);
    output += metricHeader(
      'aya_alert_resolved_states',
      'Staffing alerts retained in the resolved state.',
      'gauge',
    );
    output += metric('aya_alert_resolved_states', resolvedAlerts);

    return output;
  }
}
