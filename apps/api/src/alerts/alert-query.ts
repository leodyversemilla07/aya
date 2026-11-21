import { prisma } from '@workspace/db';
import {
  OCCUPIED_ASSIGNMENT_STATUSES,
  addDays,
  daysBetween,
  occupiedAssignmentWhere,
  startOfToday,
} from '../domain/staffing';

export const STAFFING_ALERT_RULES = {
  bench: { minimumDays: 14, highSeverityDays: 30 },
  contract: { expiringDays: 30, expiredDays: 30, highSeverityDays: 7 },
  performance: {
    codeQualityThreshold: 80,
    highCodeQualityThreshold: 70,
    prMergeTimeThreshold: 3,
    highPrMergeTimeThreshold: 5,
    clientRatingThreshold: 3.5,
    highClientRatingThreshold: 3,
  },
} as const;

export type StaffingAlertType = 'bench' | 'contract' | 'performance';
export type StaffingAlertSeverity = 'high' | 'medium' | 'low';
export type StaffingAlertFilter = StaffingAlertType | 'all';

export interface ComputedStaffingAlert {
  fingerprint: string;
  type: StaffingAlertType;
  severity: StaffingAlertSeverity;
  entityType: 'developer' | 'contract';
  entityId: string;
  message: string;
  data: Record<string, unknown>;
}

/**
 * Computes the canonical staffing alert set. The agent tool and the durable
 * background scanner both consume this function so chat and proactive
 * notifications cannot drift apart.
 */
export async function queryStaffingAlerts(
  type: StaffingAlertFilter = 'all',
  today = startOfToday(),
): Promise<ComputedStaffingAlert[]> {
  const alerts: ComputedStaffingAlert[] = [];

  if (type === 'all' || type === 'bench') {
    const benchDevelopers = await prisma.developer.findMany({
      where: {
        benchSince: { not: null },
        assignments: {
          none: occupiedAssignmentWhere(today),
        },
      },
      orderBy: { benchSince: 'asc' },
    });

    for (const developer of benchDevelopers) {
      if (!developer.benchSince) continue;
      const daysOnBench = daysBetween(developer.benchSince, today);
      if (daysOnBench > STAFFING_ALERT_RULES.bench.minimumDays) {
        alerts.push({
          fingerprint: `bench:${developer.id}`,
          type: 'bench',
          severity: daysOnBench > STAFFING_ALERT_RULES.bench.highSeverityDays ? 'high' : 'medium',
          entityType: 'developer',
          entityId: developer.id,
          message: `${developer.name} has been on the bench for ${daysOnBench} days`,
          data: { developerId: developer.id, daysOnBench, benchSince: developer.benchSince },
        });
      }
    }
  }

  if (type === 'all' || type === 'contract') {
    const contracts = await prisma.contract.findMany({
      where: {
        status: { in: ['active', 'renewing', 'expired'] },
        startDate: { lte: today },
        endDate: {
          gte: addDays(today, -STAFFING_ALERT_RULES.contract.expiredDays),
          lte: addDays(today, STAFFING_ALERT_RULES.contract.expiringDays),
        },
      },
      include: { developer: true, client: true },
      orderBy: { endDate: 'asc' },
    });

    for (const contract of contracts) {
      const daysLeft = daysBetween(today, contract.endDate);
      const severity: StaffingAlertSeverity =
        daysLeft < STAFFING_ALERT_RULES.contract.highSeverityDays ? 'high' : 'medium';
      const message =
        daysLeft < 0
          ? `${contract.developer.name}'s contract at ${contract.client.name} expired ${Math.abs(
              daysLeft,
            )} days ago`
          : `${contract.developer.name}'s contract at ${contract.client.name} expires in ${daysLeft} days`;

      alerts.push({
        fingerprint: `contract:${contract.id}`,
        type: 'contract',
        severity,
        entityType: 'contract',
        entityId: contract.id,
        message,
        data: {
          contractId: contract.id,
          developerId: contract.developerId,
          clientId: contract.clientId,
          daysLeft,
          endDate: contract.endDate,
        },
      });
    }
  }

  if (type === 'all' || type === 'performance') {
    const performances = await prisma.performance.findMany({
      include: { developer: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const latestByDeveloper = new Map<string, (typeof performances)[number]>();
    for (const performance of performances) {
      if (!latestByDeveloper.has(performance.developerId)) {
        latestByDeveloper.set(performance.developerId, performance);
      }
    }

    for (const performance of latestByDeveloper.values()) {
      const issues: string[] = [];
      if (performance.codeQuality < STAFFING_ALERT_RULES.performance.codeQualityThreshold) {
        issues.push(`code quality is ${performance.codeQuality}/100`);
      }
      if (performance.prMergeTime > STAFFING_ALERT_RULES.performance.prMergeTimeThreshold) {
        issues.push(`PR merge time is ${performance.prMergeTime} days`);
      }
      if (
        performance.clientRating !== null &&
        performance.clientRating < STAFFING_ALERT_RULES.performance.clientRatingThreshold
      ) {
        issues.push(`client rating is ${performance.clientRating}/5`);
      }
      if (issues.length === 0) continue;

      const severity: StaffingAlertSeverity =
        performance.codeQuality < STAFFING_ALERT_RULES.performance.highCodeQualityThreshold ||
        performance.prMergeTime > STAFFING_ALERT_RULES.performance.highPrMergeTimeThreshold ||
        (performance.clientRating !== null &&
          performance.clientRating < STAFFING_ALERT_RULES.performance.highClientRatingThreshold)
          ? 'high'
          : 'medium';

      alerts.push({
        fingerprint: `performance:${performance.developerId}`,
        type: 'performance',
        severity,
        entityType: 'developer',
        entityId: performance.developerId,
        message: `${performance.developer.name} needs attention: ${issues.join(', ')}`,
        data: {
          developerId: performance.developerId,
          period: performance.period,
          codeQuality: performance.codeQuality,
          prMergeTime: performance.prMergeTime,
          clientRating: performance.clientRating,
        },
      });
    }
  }

  const severityOrder: Record<StaffingAlertSeverity, number> = { high: 0, medium: 1, low: 2 };
  alerts.sort(
    (left, right) =>
      severityOrder[left.severity] - severityOrder[right.severity] ||
      left.type.localeCompare(right.type) ||
      left.message.localeCompare(right.message),
  );

  return alerts;
}
