import { Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma, containsIgnoreCase, prisma } from '@workspace/db';
import type { z } from 'zod';
import { syncBenchState } from '../domain/bench-state';
import { occupiedAssignmentWhere, startOfToday } from '../domain/staffing';
import { contractInclude, toContract } from './contracts.mapper';
import { emptyToNull, rethrowPrismaError } from './management.http';
import type {
  clientCreateSchema,
  clientListQuerySchema,
  clientUpdateSchema,
} from './management.schemas';

type ClientListQuery = z.infer<typeof clientListQuerySchema>;
type ClientCreateInput = z.infer<typeof clientCreateSchema>;
type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;

const developerSummary = { select: { id: true, name: true, role: true, seniority: true } } as const;
const clientSummary = { select: { id: true, name: true } } as const;

const clientDetailInclude = {
  contacts: { orderBy: { name: 'asc' } },
  assignments: {
    include: { developer: developerSummary, client: clientSummary },
    orderBy: { startDate: 'desc' },
  },
  contracts: {
    include: contractInclude,
    orderBy: { startDate: 'desc' },
  },
} satisfies Prisma.ClientInclude;

@Injectable()
export class ClientsService {
  async list(query: ClientListQuery) {
    const today = startOfToday();
    const where: Prisma.ClientWhereInput = {};
    const and: Prisma.ClientWhereInput[] = [];

    if (query.search) {
      and.push({
        OR: [
          { name: containsIgnoreCase(query.search) },
          { industry: containsIgnoreCase(query.search) },
        ],
      });
    }
    if (query.industry) where.industry = containsIgnoreCase(query.industry);
    if (and.length > 0) where.AND = and;

    const [total, clients] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.findMany({
        where,
        include: {
          _count: { select: { contacts: true, contracts: true, assignments: true } },
          assignments: {
            where: occupiedAssignmentWhere(today),
            select: { developerId: true },
          },
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
      items: clients.map((client) => ({
        id: client.id,
        name: client.name,
        industry: client.industry,
        logoUrl: client.logoUrl,
        contactCount: client._count.contacts,
        contractCount: client._count.contracts,
        assignmentCount: client._count.assignments,
        activeDeveloperCount: new Set(client.assignments.map((row) => row.developerId)).size,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
      })),
    };
  }

  async get(id: string): Promise<unknown> {
    const client = await prisma.client.findUnique({
      where: { id },
      include: clientDetailInclude,
    });
    if (!client) throw new NotFoundException(`Client "${id}" was not found.`);
    return {
      ...client,
      contracts: client.contracts.map(toContract),
    };
  }

  async create(input: ClientCreateInput): Promise<unknown> {
    try {
      const created = await prisma.client.create({
        data: {
          name: input.name,
          industry: input.industry,
          logoUrl: emptyToNull(input.logoUrl),
          contacts: {
            create: input.contacts.map((contact) => ({
              name: contact.name,
              role: contact.role,
              email: contact.email,
              phone: emptyToNull(contact.phone),
            })),
          },
        },
      });
      return this.get(created.id);
    } catch (error) {
      rethrowPrismaError(error, 'Client');
    }
  }

  async update(id: string, input: ClientUpdateInput): Promise<unknown> {
    await this.ensureExists(id);
    const data: Prisma.ClientUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.industry !== undefined) data.industry = input.industry;
    if (input.logoUrl !== undefined) data.logoUrl = emptyToNull(input.logoUrl);

    try {
      await prisma.$transaction(async (tx) => {
        if (Object.keys(data).length > 0) {
          await tx.client.update({ where: { id }, data });
        }
        if (input.contacts !== undefined) {
          await tx.contact.deleteMany({ where: { clientId: id } });
          if (input.contacts.length > 0) {
            await tx.contact.createMany({
              data: input.contacts.map((contact) => ({
                clientId: id,
                name: contact.name,
                role: contact.role,
                email: contact.email,
                phone: emptyToNull(contact.phone),
              })),
            });
          }
        }
      });
    } catch (error) {
      rethrowPrismaError(error, 'Client');
    }

    return this.get(id);
  }

  async remove(id: string) {
    await this.ensureExists(id);

    // Deleting a client cascades to its assignments, so the affected
    // developers need their bench state reconciled.
    const affectedDevelopers = await prisma.assignment.findMany({
      where: { clientId: id },
      select: { developerId: true },
    });

    const affectedDeveloperIds = [
      ...new Set(affectedDevelopers.map((assignment) => assignment.developerId)),
    ];

    await prisma.$transaction(async (tx) => {
      await tx.client.delete({ where: { id } });
      for (const developerId of affectedDeveloperIds) {
        await syncBenchState(tx, developerId);
      }
    });

    return { deleted: true, id };
  }

  private async ensureExists(id: string) {
    const client = await prisma.client.findUnique({ where: { id }, select: { id: true } });
    if (!client) throw new NotFoundException(`Client "${id}" was not found.`);
  }
}
