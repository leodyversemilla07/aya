import { Injectable } from '@nestjs/common';
import { prisma } from '@workspace/db';
import { addDays, startOfToday } from '../domain/staffing';
import {
  type CapacityForecast,
  DEFAULT_HORIZON_WEEKS,
  MAX_HORIZON_WEEKS,
  buildForecast,
} from './forecast';

export interface ForecastOptions {
  weeks?: number;
  clientId?: string;
  today?: Date;
}

@Injectable()
export class ForecastService {
  async forecast(options: ForecastOptions = {}): Promise<CapacityForecast> {
    const today = startOfToday(options.today ?? new Date());
    const weeks = Math.min(
      MAX_HORIZON_WEEKS,
      Math.max(1, Math.floor(options.weeks ?? DEFAULT_HORIZON_WEEKS)),
    );
    const horizonEnd = addDays(today, weeks * 7);

    const [developers, contracts] = await Promise.all([
      prisma.developer.findMany({
        include: {
          skills: { orderBy: { name: 'asc' } },
          assignments: { include: { client: true } },
          performance: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      prisma.contract.findMany({
        where: {
          status: { in: ['active', 'renewing'] },
          startDate: { lte: today },
          endDate: { gte: today, lte: horizonEnd },
        },
        include: { client: true },
        orderBy: { endDate: 'asc' },
      }),
    ]);

    return buildForecast({
      developers: developers.map((developer) => ({
        id: developer.id,
        name: developer.name,
        role: developer.role,
        seniority: developer.seniority,
        benchSince: developer.benchSince,
        skills: developer.skills.map((skill) => ({
          name: skill.name,
          level: skill.level,
          yearsExp: skill.yearsExp,
        })),
        assignments: developer.assignments.map((assignment) => ({
          clientId: assignment.clientId,
          clientName: assignment.client.name,
          clientIndustry: assignment.client.industry,
          startDate: assignment.startDate,
          endDate: assignment.endDate,
          status: assignment.status,
        })),
        performance: developer.performance[0]
          ? {
              clientRating: developer.performance[0].clientRating,
              codeQuality: developer.performance[0].codeQuality,
            }
          : null,
      })),
      contracts: contracts.map((contract) => ({
        id: contract.id,
        developerId: contract.developerId,
        clientId: contract.clientId,
        clientName: contract.client.name,
        clientIndustry: contract.client.industry,
        startDate: contract.startDate,
        endDate: contract.endDate,
        status: contract.status,
        billingRate: Number(contract.billingRate),
      })),
      today,
      weeks,
      ...(options.clientId ? { clientId: options.clientId } : {}),
    });
  }
}
