import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma, prisma } from '@workspace/db';
import type { z } from 'zod';
import { occupiedAssignmentWhere, startOfToday } from '../domain/staffing';
import { emptyToNull, rethrowPrismaError } from './management.http';
import type {
  assignmentCreateSchema,
  assignmentListQuerySchema,
  assignmentUpdateSchema,
} from './management.schemas';

type AssignmentListQuery = z.infer<typeof assignmentListQuerySchema>;
type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>;
type AssignmentUpdateInput = z.infer<typeof assignmentUpdateSchema>;

const assignmentInclude = {
  developer: { select: { id: true, name: true, role: true, seniority: true } },
  client: { select: { id: true, name: true, industry: true } },
} as const;

type AssignmentRecord = Prisma.AssignmentGetPayload<{ include: typeof assignmentInclude }>;

function toAssignment(assignment: AssignmentRecord) {
  return {
    id: assignment.id,
    developerId: assignment.developerId,
    developer: assignment.developer,
    clientId: assignment.clientId,
    client: assignment.client,
    projectName: assignment.projectName,
    status: assignment.status,
    startDate: assignment.startDate,
    endDate: assignment.endDate,
    jiraBoardUrl: assignment.jiraBoardUrl,
    githubRepoUrl: assignment.githubRepoUrl,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
  };
}

@Injectable()
export class AssignmentsService {
  async list(query: AssignmentListQuery) {
    const today = startOfToday();
    const where: Prisma.AssignmentWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.clientId) where.clientId = query.clientId;
    if (query.developerId) where.developerId = query.developerId;
    if (query.active === true) Object.assign(where, occupiedAssignmentWhere(today));
    if (query.active === false) where.NOT = occupiedAssignmentWhere(today);

    const [total, assignments] = await Promise.all([
      prisma.assignment.count({ where }),
      prisma.assignment.findMany({
        where,
        include: assignmentInclude,
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        skip: query.offset,
        take: query.limit,
      }),
    ]);

    return {
      total,
      limit: query.limit,
      offset: query.offset,
      items: assignments.map(toAssignment),
    };
  }

  async get(id: string) {
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: assignmentInclude,
    });
    if (!assignment) throw new NotFoundException(`Assignment "${id}" was not found.`);
    return toAssignment(assignment);
  }

  async create(input: AssignmentCreateInput) {
    await this.ensureRelations(input.developerId, input.clientId);
    try {
      const assignment = await prisma.assignment.create({
        data: {
          developerId: input.developerId,
          clientId: input.clientId,
          projectName: input.projectName,
          status: input.status,
          startDate: input.startDate,
          endDate: input.endDate ?? null,
          jiraBoardUrl: emptyToNull(input.jiraBoardUrl),
          githubRepoUrl: emptyToNull(input.githubRepoUrl),
        },
        include: assignmentInclude,
      });
      return toAssignment(assignment);
    } catch (error) {
      rethrowPrismaError(error, 'Assignment');
    }
  }

  async update(id: string, input: AssignmentUpdateInput) {
    const existing = await prisma.assignment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Assignment "${id}" was not found.`);

    if (input.developerId || input.clientId) {
      await this.ensureRelations(
        input.developerId ?? existing.developerId,
        input.clientId ?? existing.clientId,
      );
    }

    const startDate = input.startDate ?? existing.startDate;
    const endDate = input.endDate === undefined ? existing.endDate : input.endDate;
    if (endDate && endDate < startDate) {
      throw new BadRequestException('endDate must be on or after startDate.');
    }

    try {
      const assignment = await prisma.assignment.update({
        where: { id },
        data: {
          ...(input.developerId !== undefined ? { developerId: input.developerId } : {}),
          ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
          ...(input.projectName !== undefined ? { projectName: input.projectName } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
          ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
          ...(input.jiraBoardUrl !== undefined
            ? { jiraBoardUrl: emptyToNull(input.jiraBoardUrl) }
            : {}),
          ...(input.githubRepoUrl !== undefined
            ? { githubRepoUrl: emptyToNull(input.githubRepoUrl) }
            : {}),
        },
        include: assignmentInclude,
      });
      return toAssignment(assignment);
    } catch (error) {
      rethrowPrismaError(error, 'Assignment');
    }
  }

  async remove(id: string) {
    const assignment = await prisma.assignment.findUnique({ where: { id }, select: { id: true } });
    if (!assignment) throw new NotFoundException(`Assignment "${id}" was not found.`);
    await prisma.assignment.delete({ where: { id } });
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
