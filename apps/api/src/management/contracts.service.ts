import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma, prisma } from '@workspace/db';
import type { z } from 'zod';
import { addDays, startOfToday } from '../domain/staffing';
import { contractInclude, toContract } from './contracts.mapper';
import { rethrowPrismaError } from './management.http';
import type {
  contractCreateSchema,
  contractListQuerySchema,
  contractUpdateSchema,
} from './management.schemas';

type ContractListQuery = z.infer<typeof contractListQuerySchema>;
type ContractCreateInput = z.infer<typeof contractCreateSchema>;
type ContractUpdateInput = z.infer<typeof contractUpdateSchema>;

@Injectable()
export class ContractsService {
  async list(query: ContractListQuery) {
    const today = startOfToday();
    const where: Prisma.ContractWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.clientId) where.clientId = query.clientId;
    if (query.developerId) where.developerId = query.developerId;
    if (query.expiringWithin !== undefined) {
      if (!where.status) where.status = { in: ['active', 'renewing'] };
      where.endDate = { gte: today, lte: addDays(today, query.expiringWithin) };
    }

    const [total, contracts] = await Promise.all([
      prisma.contract.count({ where }),
      prisma.contract.findMany({
        where,
        include: contractInclude,
        orderBy: { endDate: 'asc' },
        skip: query.offset,
        take: query.limit,
      }),
    ]);

    return {
      total,
      limit: query.limit,
      offset: query.offset,
      items: contracts.map(toContract),
    };
  }

  async get(id: string) {
    const contract = await prisma.contract.findUnique({ where: { id }, include: contractInclude });
    if (!contract) throw new NotFoundException(`Contract "${id}" was not found.`);
    return toContract(contract);
  }

  async create(input: ContractCreateInput) {
    await this.ensureRelations(input.developerId, input.clientId);
    try {
      const contract = await prisma.contract.create({
        data: {
          developerId: input.developerId,
          clientId: input.clientId,
          startDate: input.startDate,
          endDate: input.endDate,
          billingRate: input.billingRate,
          status: input.status,
        },
        include: contractInclude,
      });
      return toContract(contract);
    } catch (error) {
      rethrowPrismaError(error, 'Contract');
    }
  }

  async update(id: string, input: ContractUpdateInput) {
    const existing = await prisma.contract.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Contract "${id}" was not found.`);

    if (input.developerId || input.clientId) {
      await this.ensureRelations(
        input.developerId ?? existing.developerId,
        input.clientId ?? existing.clientId,
      );
    }

    const startDate = input.startDate ?? existing.startDate;
    const endDate = input.endDate ?? existing.endDate;
    if (endDate < startDate) {
      throw new BadRequestException('endDate must be on or after startDate.');
    }

    try {
      const contract = await prisma.contract.update({
        where: { id },
        data: {
          ...(input.developerId !== undefined ? { developerId: input.developerId } : {}),
          ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
          ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
          ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
          ...(input.billingRate !== undefined ? { billingRate: input.billingRate } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
        include: contractInclude,
      });
      return toContract(contract);
    } catch (error) {
      rethrowPrismaError(error, 'Contract');
    }
  }

  async remove(id: string) {
    const contract = await prisma.contract.findUnique({ where: { id }, select: { id: true } });
    if (!contract) throw new NotFoundException(`Contract "${id}" was not found.`);
    await prisma.contract.delete({ where: { id } });
    return { deleted: true, id };
  }

  private async ensureRelations(developerId: string, clientId: string) {
    const [developer, client] = await Promise.all([
      prisma.developer.findUnique({ where: { id: developerId }, select: { id: true } }),
      prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }),
    ]);
    if (!developer) throw new BadRequestException(`Developer "${developerId}" does not exist.`);
    if (!client) throw new BadRequestException(`Client "${clientId}" does not exist.`);
  }
}
