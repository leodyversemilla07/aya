import type { Prisma } from '@workspace/db';
import { daysBetween, startOfToday } from '../domain/staffing';

export const contractInclude = {
  developer: { select: { id: true, name: true, role: true, seniority: true } },
  client: { select: { id: true, name: true, industry: true } },
} as const;

export type ContractRecord = Prisma.ContractGetPayload<{ include: typeof contractInclude }>;

/**
 * Converts a Prisma contract, including its Decimal billing rate, into the
 * plain JSON shape shared by every management endpoint.
 */
export function toContract(contract: ContractRecord) {
  const today = startOfToday();
  const daysUntilExpiry = daysBetween(today, contract.endDate);
  return {
    id: contract.id,
    developerId: contract.developerId,
    developer: contract.developer,
    clientId: contract.clientId,
    client: contract.client,
    startDate: contract.startDate,
    endDate: contract.endDate,
    billingRate: Number(contract.billingRate),
    status: contract.status,
    daysUntilExpiry,
    isExpired: daysUntilExpiry < 0,
    createdAt: contract.createdAt,
    updatedAt: contract.updatedAt,
  };
}
