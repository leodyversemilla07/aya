import type { Prisma } from '@workspace/db';

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Assignment states that still represent an occupied developer. A transition
 * or ending assignment is not bench capacity until it has actually ended.
 */
export const OCCUPIED_ASSIGNMENT_STATUSES = ['active', 'ending', 'transition'] as const;

export function startOfToday(date = new Date()): Date {
  const today = new Date(date);
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / DAY_MS);
}

/**
 * A single source of truth for "currently assigned" so dashboard metrics,
 * roster queries, utilization, alerts, and matching cannot drift apart.
 */
export function occupiedAssignmentWhere(today: Date): Prisma.AssignmentWhereInput {
  return {
    status: { in: [...OCCUPIED_ASSIGNMENT_STATUSES] },
    startDate: { lte: today },
    OR: [{ endDate: null }, { endDate: { gte: today } }],
  };
}

export function isOccupiedAssignment(
  assignment: { status: string; startDate: Date; endDate: Date | null },
  today: Date,
): boolean {
  return (
    (OCCUPIED_ASSIGNMENT_STATUSES as readonly string[]).includes(assignment.status) &&
    assignment.startDate <= today &&
    (assignment.endDate === null || assignment.endDate >= today)
  );
}
