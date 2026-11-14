import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma, containsIgnoreCase, prisma } from '@workspace/db';
import type { z } from 'zod';
import { isCurrentlyAssigned, syncBenchState } from '../domain/bench-state';
import { isOccupiedAssignment, occupiedAssignmentWhere, startOfToday } from '../domain/staffing';
import { contractInclude, toContract } from './contracts.mapper';
import { emptyToNull, rethrowPrismaError } from './management.http';
import type {
  developerCreateSchema,
  developerListQuerySchema,
  developerUpdateSchema,
} from './management.schemas';

type DeveloperListQuery = z.infer<typeof developerListQuerySchema>;
type DeveloperCreateInput = z.infer<typeof developerCreateSchema>;
type DeveloperUpdateInput = z.infer<typeof developerUpdateSchema>;

const clientSummary = { select: { id: true, name: true } } as const;
const partySummary = { select: { id: true, name: true } } as const;

const developerDetailInclude = {
  skills: { orderBy: { name: 'asc' } },
  assignments: {
    include: { client: clientSummary, developer: partySummary },
    orderBy: { startDate: 'desc' },
  },
  contracts: {
    include: contractInclude,
    orderBy: { startDate: 'desc' },
  },
  performance: { orderBy: [{ period: 'desc' }, { createdAt: 'desc' }] },
} satisfies Prisma.DeveloperInclude;

@Injectable()
export class DevelopersService {
  async list(query: DeveloperListQuery) {
    const today = startOfToday();
    const where: Prisma.DeveloperWhereInput = {};
    const and: Prisma.DeveloperWhereInput[] = [];
    const activeAssignment = occupiedAssignmentWhere(today);

    if (query.search) {
      and.push({
        OR: [
          { name: containsIgnoreCase(query.search) },
          { email: containsIgnoreCase(query.search) },
          { role: containsIgnoreCase(query.search) },
        ],
      });
    }
    if (query.seniority) where.seniority = query.seniority;
    if (query.skill) {
      and.push({ skills: { some: { name: containsIgnoreCase(query.skill) } } });
    }
    if (query.clientId) {
      and.push({ assignments: { some: { ...activeAssignment, clientId: query.clientId } } });
    }
    if (query.onBench === true) {
      and.push({ assignments: { none: activeAssignment } });
    } else if (query.onBench === false) {
      and.push({ assignments: { some: activeAssignment } });
    }
    if (and.length > 0) where.AND = and;

    const [total, developers] = await Promise.all([
      prisma.developer.count({ where }),
      prisma.developer.findMany({
        where,
        include: {
          skills: { orderBy: { name: 'asc' } },
          assignments: {
            where: activeAssignment,
            include: { client: clientSummary },
            orderBy: { startDate: 'desc' },
            take: 1,
          },
          _count: { select: { contracts: true } },
        },
        orderBy: { name: 'asc' },
        skip: query.offset,
        take: query.limit,
      }),
    ]);

    return {
      total,
      limit: query.limit,
      offset: query.offset,
      items: developers.map((developer) => {
        const assignment = developer.assignments[0];
        return {
          id: developer.id,
          name: developer.name,
          email: developer.email,
          role: developer.role,
          seniority: developer.seniority,
          avatarUrl: developer.avatarUrl,
          benchSince: developer.benchSince,
          skills: developer.skills.map((skill) => ({
            id: skill.id,
            name: skill.name,
            level: skill.level,
            yearsExp: skill.yearsExp,
          })),
          currentAssignment: assignment
            ? {
                id: assignment.id,
                projectName: assignment.projectName,
                clientId: assignment.client.id,
                clientName: assignment.client.name,
                endDate: assignment.endDate,
              }
            : null,
          onBench: !assignment,
          contractCount: developer._count.contracts,
          createdAt: developer.createdAt,
          updatedAt: developer.updatedAt,
        };
      }),
    };
  }

  async get(id: string): Promise<unknown> {
    const developer = await prisma.developer.findUnique({
      where: { id },
      include: developerDetailInclude,
    });
    if (!developer) throw new NotFoundException(`Developer "${id}" was not found.`);

    const today = startOfToday();
    const currentAssignment =
      developer.assignments.find((assignment) => isOccupiedAssignment(assignment, today)) ?? null;

    return {
      ...developer,
      contracts: developer.contracts.map(toContract),
      onBench: currentAssignment === null,
      currentAssignment: currentAssignment
        ? {
            id: currentAssignment.id,
            projectName: currentAssignment.projectName,
            clientId: currentAssignment.client.id,
            clientName: currentAssignment.client.name,
            endDate: currentAssignment.endDate,
          }
        : null,
    };
  }

  async create(input: DeveloperCreateInput): Promise<unknown> {
    try {
      const created = await prisma.developer.create({
        data: {
          name: input.name,
          email: input.email,
          role: input.role,
          seniority: input.seniority,
          avatarUrl: emptyToNull(input.avatarUrl),
          // A new developer has no assignment, so their bench period starts now
          // unless an earlier start date is supplied.
          benchSince: input.benchSince ?? startOfToday(),
          skills: {
            create: input.skills.map((skill) => ({
              name: skill.name,
              level: skill.level,
              yearsExp: skill.yearsExp,
            })),
          },
        },
      });
      return this.get(created.id);
    } catch (error) {
      rethrowPrismaError(error, 'Developer');
    }
  }

  async update(id: string, input: DeveloperUpdateInput): Promise<unknown> {
    await this.ensureExists(id);
    const data: Prisma.DeveloperUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.email !== undefined) data.email = input.email;
    if (input.role !== undefined) data.role = input.role;
    if (input.seniority !== undefined) data.seniority = input.seniority;
    if (input.avatarUrl !== undefined) data.avatarUrl = emptyToNull(input.avatarUrl);
    if (input.benchSince !== undefined) {
      if (input.benchSince !== null && (await isCurrentlyAssigned(prisma, id))) {
        throw new BadRequestException(
          'benchSince cannot be set while the developer holds an active assignment.',
        );
      }
      data.benchSince = input.benchSince;
    }

    try {
      await prisma.$transaction(async (tx) => {
        if (Object.keys(data).length > 0) {
          await tx.developer.update({ where: { id }, data });
        }
        if (input.skills !== undefined) {
          await tx.skill.deleteMany({ where: { developerId: id } });
          if (input.skills.length > 0) {
            await tx.skill.createMany({
              data: input.skills.map((skill) => ({
                developerId: id,
                name: skill.name,
                level: skill.level,
                yearsExp: skill.yearsExp,
              })),
            });
          }
        }
        // Keep the bench period aligned with the developer's staffing state.
        await syncBenchState(tx, id);
      });
    } catch (error) {
      rethrowPrismaError(error, 'Developer');
    }

    return this.get(id);
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await prisma.developer.delete({ where: { id } });
    return { deleted: true, id };
  }

  private async ensureExists(id: string) {
    const developer = await prisma.developer.findUnique({ where: { id }, select: { id: true } });
    if (!developer) throw new NotFoundException(`Developer "${id}" was not found.`);
  }
}
