import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma, prisma } from '@workspace/db';
import type { z } from 'zod';
import { rethrowPrismaError } from './management.http';
import type {
  performanceCreateSchema,
  performanceListQuerySchema,
  performanceUpdateSchema,
} from './management.schemas';

type PerformanceListQuery = z.infer<typeof performanceListQuerySchema>;
type PerformanceCreateInput = z.infer<typeof performanceCreateSchema>;
type PerformanceUpdateInput = z.infer<typeof performanceUpdateSchema>;

const performanceInclude = {
  developer: { select: { id: true, name: true, role: true, seniority: true } },
} as const;

type PerformanceRecord = Prisma.PerformanceGetPayload<{ include: typeof performanceInclude }>;

function toPerformance(performance: PerformanceRecord) {
  return {
    id: performance.id,
    developerId: performance.developerId,
    developer: performance.developer,
    period: performance.period,
    velocity: performance.velocity,
    prMergeTime: performance.prMergeTime,
    codeQuality: performance.codeQuality,
    clientRating: performance.clientRating,
    notes: performance.notes,
    createdAt: performance.createdAt,
  };
}

@Injectable()
export class PerformanceService {
  async list(query: PerformanceListQuery) {
    const where: Prisma.PerformanceWhereInput = {};
    if (query.developerId) where.developerId = query.developerId;
    if (query.period) where.period = query.period;

    const [total, records] = await Promise.all([
      prisma.performance.count({ where }),
      prisma.performance.findMany({
        where,
        include: performanceInclude,
        orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
        skip: query.offset,
        take: query.limit,
      }),
    ]);

    return {
      total,
      limit: query.limit,
      offset: query.offset,
      items: records.map(toPerformance),
    };
  }

  async get(id: string) {
    const performance = await prisma.performance.findUnique({
      where: { id },
      include: performanceInclude,
    });
    if (!performance) throw new NotFoundException(`Performance record "${id}" was not found.`);
    return toPerformance(performance);
  }

  async create(input: PerformanceCreateInput) {
    await this.ensureDeveloper(input.developerId);
    try {
      const performance = await prisma.performance.create({
        data: {
          developerId: input.developerId,
          period: input.period,
          velocity: input.velocity,
          prMergeTime: input.prMergeTime,
          codeQuality: input.codeQuality,
          clientRating: input.clientRating ?? null,
          notes: input.notes?.trim() ? input.notes.trim() : null,
        },
        include: performanceInclude,
      });
      return toPerformance(performance);
    } catch (error) {
      rethrowPrismaError(error, 'Performance record');
    }
  }

  async update(id: string, input: PerformanceUpdateInput) {
    const existing = await prisma.performance.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Performance record "${id}" was not found.`);

    if (input.developerId) await this.ensureDeveloper(input.developerId);

    try {
      const performance = await prisma.performance.update({
        where: { id },
        data: {
          ...(input.developerId !== undefined ? { developerId: input.developerId } : {}),
          ...(input.period !== undefined ? { period: input.period } : {}),
          ...(input.velocity !== undefined ? { velocity: input.velocity } : {}),
          ...(input.prMergeTime !== undefined ? { prMergeTime: input.prMergeTime } : {}),
          ...(input.codeQuality !== undefined ? { codeQuality: input.codeQuality } : {}),
          ...(input.clientRating !== undefined ? { clientRating: input.clientRating } : {}),
          ...(input.notes !== undefined
            ? { notes: input.notes?.trim() ? input.notes.trim() : null }
            : {}),
        },
        include: performanceInclude,
      });
      return toPerformance(performance);
    } catch (error) {
      rethrowPrismaError(error, 'Performance record');
    }
  }

  async remove(id: string) {
    const performance = await prisma.performance.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!performance) throw new NotFoundException(`Performance record "${id}" was not found.`);
    await prisma.performance.delete({ where: { id } });
    return { deleted: true, id };
  }

  private async ensureDeveloper(developerId: string) {
    const developer = await prisma.developer.findUnique({
      where: { id: developerId },
      select: { id: true },
    });
    if (!developer) {
      throw new BadRequestException(`Developer "${developerId}" does not exist.`);
    }
  }
}
