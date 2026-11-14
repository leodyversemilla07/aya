import type { Prisma } from '@workspace/db';
import { occupiedAssignmentWhere, startOfToday } from './staffing';

/**
 * The slice of Prisma that bench-state reconciliation needs. Both the plain
 * client and a transaction client satisfy it.
 */
export type BenchStateClient = Pick<Prisma.TransactionClient, 'assignment' | 'developer'>;

/**
 * `benchSince` marks the start of a developer's current bench period, so it is
 * only meaningful while they are unassigned:
 *
 * - A developer holding an assignment has no bench period, so it is cleared.
 * - A developer without one is on the bench, so the period is recorded. The
 *   existing date is kept when it is already known; otherwise the bench period
 *   starts today.
 *
 * The dashboard, the agent's roster tool, and the risk alerts all read
 * `benchSince`, so it has to follow the assignment lifecycle instead of
 * drifting out of sync with it.
 */
export async function syncBenchState(
  client: BenchStateClient,
  developerId: string,
  today: Date = startOfToday(),
): Promise<void> {
  const occupied = await client.assignment.count({
    where: { developerId, ...occupiedAssignmentWhere(today) },
  });

  if (occupied > 0) {
    await client.developer.updateMany({
      where: { id: developerId, benchSince: { not: null } },
      data: { benchSince: null },
    });
    return;
  }

  await client.developer.updateMany({
    where: { id: developerId, benchSince: null },
    data: { benchSince: today },
  });
}

/**
 * Reports whether a developer currently occupies an assignment, which decides
 * if a bench start date makes sense for them.
 */
export async function isCurrentlyAssigned(
  client: Pick<Prisma.TransactionClient, 'assignment'>,
  developerId: string,
  today: Date = startOfToday(),
): Promise<boolean> {
  const occupied = await client.assignment.count({
    where: { developerId, ...occupiedAssignmentWhere(today) },
  });
  return occupied > 0;
}
