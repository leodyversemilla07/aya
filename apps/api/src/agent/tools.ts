import { type Prisma, prisma } from '@workspace/db';
import { z } from 'zod';
import {
  OCCUPIED_ASSIGNMENT_STATUSES,
  addDays,
  daysBetween,
  isOccupiedAssignment,
  occupiedAssignmentWhere,
  startOfToday,
} from '../domain/staffing';
import { canonicalizeSkillName, skillNamesMatch } from './skills';

// ─── Helpers ──────────────────────────────────────────

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function parseDate(value: string, field: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  // Date normalizes impossible calendar dates (for example 2026-02-31) instead
  // of rejecting them, so round-trip the value to catch those cases.
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${field} must be a valid date in YYYY-MM-DD format.`);
  }
  return date;
}

async function resolveClientId(args: {
  clientId?: string;
  clientName?: string;
}): Promise<string | undefined> {
  if (args.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: args.clientId },
      select: { id: true },
    });
    if (!client) throw new Error(`No client found with ID "${args.clientId}".`);
    return client.id;
  }

  if (args.clientName) {
    const requestedName = normalize(args.clientName);
    const candidates = await prisma.client.findMany({
      where: { name: { contains: args.clientName } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    if (candidates.length === 0) {
      throw new Error(`No client matched "${args.clientName}".`);
    }

    const exactMatches = candidates.filter((client) => normalize(client.name) === requestedName);
    if (exactMatches.length === 1) {
      return exactMatches[0]?.id;
    }
    if (exactMatches.length > 1) {
      throw new Error(
        `Multiple clients matched "${args.clientName}". Use the exact client name or ID.`,
      );
    }
    if (candidates.length === 1) {
      return candidates[0]?.id;
    }

    throw new Error(
      `Multiple clients matched "${args.clientName}": ${candidates
        .map((client) => client.name)
        .join(', ')}. Use the exact client name or ID.`,
    );
  }

  return undefined;
}

// ─── Tool Schemas ─────────────────────────────────────

export const schemas = {
  query_roster: z.object({
    skills: z
      .array(z.string().trim().min(1))
      .max(20)
      .nullish()
      .describe('Filter by skill names; all listed skills must match'),
    availableAfter: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
      .nullish()
      .describe('Available after this date (YYYY-MM-DD)'),
    seniority: z
      .enum(['junior', 'mid', 'senior', 'lead'])
      .nullish()
      .describe('Filter by seniority: junior, mid, senior, lead'),
    currentClient: z.string().trim().min(1).nullish().describe('Filter by current client name'),
    clientId: z.string().trim().min(1).nullish().describe('Filter by current client ID'),
    onBench: z
      .boolean()
      .nullish()
      .describe('True = only developers without an active assignment, false = only assigned'),
  }),
  match_developers: z.object({
    requiredSkills: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(20)
      .describe('Required skill names; all listed skills must match'),
    seniority: z
      .enum(['junior', 'mid', 'senior', 'lead'])
      .nullish()
      .describe('Preferred seniority'),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
      .describe('When the project starts (YYYY-MM-DD)'),
    teamSize: z.number().int().min(1).max(20).nullish().describe('How many developers are needed'),
    industry: z
      .string()
      .trim()
      .min(1)
      .nullish()
      .describe('Prefer developers with experience in this industry'),
  }),
  get_utilization: z.object({
    clientId: z.string().trim().min(1).nullish().describe('Filter by specific client ID'),
    clientName: z.string().trim().min(1).nullish().describe('Filter by specific client name'),
    seniority: z
      .enum(['junior', 'mid', 'senior', 'lead'])
      .nullish()
      .describe('Filter by seniority'),
  }),
  check_contracts: z.object({
    expiringWithin: z
      .number()
      .int()
      .min(0)
      .max(365)
      .nullish()
      .describe('Show contracts expiring within N days'),
    clientId: z.string().trim().min(1).nullish().describe('Filter by client ID'),
    clientName: z.string().trim().min(1).nullish().describe('Filter by client name'),
    status: z
      .enum(['active', 'renewing', 'expired'])
      .nullish()
      .describe('Filter by contract status'),
  }),
  get_performance: z.object({
    developerId: z.string().trim().min(1).nullish().describe('Specific developer ID'),
    clientId: z.string().trim().min(1).nullish().describe('All developers at a client ID'),
    clientName: z.string().trim().min(1).nullish().describe('All developers at a client name'),
    period: z.string().trim().min(1).nullish().describe("Period like '2026-Q1'"),
  }),
  get_alerts: z.object({
    type: z.enum(['all', 'bench', 'contract', 'performance']).nullish(),
  }),
} as const;

type ToolName = keyof typeof schemas;

// ─── Tool Definitions (OpenAI-compatible function calling) ──

export const tools = {
  query_roster: {
    description:
      'Search developers by skills, availability, seniority, or current client. Returns current assignment and bench status.',
    parameters: schemas.query_roster,
  },
  match_developers: {
    description:
      'Find and rank the best developer matches for a new project requirement based on skills, availability, industry experience, seniority, and performance.',
    parameters: schemas.match_developers,
  },
  get_utilization: {
    description:
      'Get team utilization metrics: total developers, active vs on bench, utilization rate, and breakdowns by client and seniority.',
    parameters: schemas.get_utilization,
  },
  check_contracts: {
    description:
      'Check contract status, billing rates, and upcoming renewals. Can filter by client and expiry window.',
    parameters: schemas.check_contracts,
  },
  get_performance: {
    description:
      'Get developer or team performance data including velocity, PR merge time, code quality, and client rating.',
    parameters: schemas.get_performance,
  },
  get_alerts: {
    description:
      'Get proactive risk alerts: long bench time, expiring or expired contracts, and performance concerns.',
    parameters: schemas.get_alerts,
  },
} satisfies Record<string, { description: string; parameters: z.ZodTypeAny }>;

// ─── Tool Handlers ────────────────────────────────────

async function queryRosterHandler(args: z.infer<typeof schemas.query_roster>) {
  const today = startOfToday();
  const where: Prisma.DeveloperWhereInput = {};
  const and: Prisma.DeveloperWhereInput[] = [];

  if (args.seniority) where.seniority = args.seniority;

  const activeAssignment = occupiedAssignmentWhere(today);

  const clientId = await resolveClientId({
    clientId: args.clientId ?? undefined,
    clientName: args.currentClient ?? undefined,
  });
  if (clientId) {
    and.push({ assignments: { some: { ...activeAssignment, clientId } } });
  }

  if (args.onBench === true) {
    and.push({ assignments: { none: activeAssignment } });
  } else if (args.onBench === false) {
    and.push({ assignments: { some: activeAssignment } });
  }

  if (args.availableAfter) {
    const availableAfter = parseDate(args.availableAfter, 'availableAfter');
    // A developer is not available after a date if any occupied assignment
    // starts by that date and continues beyond it.
    and.push({
      assignments: {
        none: {
          status: { in: [...OCCUPIED_ASSIGNMENT_STATUSES] },
          startDate: { lte: availableAfter },
          OR: [{ endDate: null }, { endDate: { gt: availableAfter } }],
        },
      },
    });
  }

  if (and.length > 0) where.AND = and;

  const developers = await prisma.developer.findMany({
    where,
    include: {
      skills: { orderBy: { name: 'asc' } },
      assignments: {
        where: activeAssignment,
        include: { client: true },
        orderBy: { startDate: 'desc' },
      },
      contracts: {
        where: { status: 'active', endDate: { gte: today } },
        orderBy: { endDate: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  const requiredSkills = [
    ...new Set((args.skills ?? []).map(canonicalizeSkillName).filter(Boolean)),
  ];
  const matchingDevelopers =
    requiredSkills.length === 0
      ? developers
      : developers.filter((developer) =>
          requiredSkills.every((requiredSkill) =>
            developer.skills.some((skill) => skillNamesMatch(skill.name, requiredSkill)),
          ),
        );

  return matchingDevelopers.slice(0, 20).map((developer) => {
    const assignment = developer.assignments[0];
    return {
      id: developer.id,
      name: developer.name,
      email: developer.email,
      role: developer.role,
      seniority: developer.seniority,
      skills: developer.skills.map((skill) => `${skill.name} (${skill.level}, ${skill.yearsExp}y)`),
      currentClient: assignment?.client.name ?? 'Bench',
      currentProject: assignment?.projectName ?? null,
      currentAssignmentEnd: assignment?.endDate ?? null,
      onBench: !assignment,
      benchSince: developer.benchSince,
      activeContracts: developer.contracts.length,
    };
  });
}

async function matchDevelopersHandler(args: z.infer<typeof schemas.match_developers>) {
  const today = startOfToday();
  const startDate = parseDate(args.startDate, 'startDate');
  const requiredSkills = [
    ...new Map(
      args.requiredSkills.map((skill) => [canonicalizeSkillName(skill), skill.trim()] as const),
    ),
  ].filter(([canonical]) => canonical.length > 0);
  const industry = args.industry ? normalize(args.industry) : undefined;

  const developers = await prisma.developer.findMany({
    include: {
      skills: true,
      // Keep the full assignment history so industry experience is not limited
      // to the developer's current client.
      assignments: {
        include: { client: true },
        orderBy: { startDate: 'desc' },
      },
      performance: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  const scored = developers.map((developer) => {
    let score = 0;
    let matchedSkillCount = 0;
    const reasons: string[] = [];
    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];

    for (const [requiredSkill, requiredSkillLabel] of requiredSkills) {
      const match = developer.skills.find((skill) => skillNamesMatch(skill.name, requiredSkill));

      if (!match) {
        missingSkills.push(requiredSkillLabel);
        continue;
      }

      matchedSkillCount++;
      matchedSkills.push(match.name);
      score +=
        match.level === 'expert'
          ? 30
          : match.level === 'advanced'
            ? 25
            : match.level === 'intermediate'
              ? 15
              : 5;
      reasons.push(`${match.name} (${match.level})`);
    }

    if (matchedSkillCount === requiredSkills.length) {
      score += 20;
      reasons.push('Matches all required skills');
    } else {
      score -= missingSkills.length * 5;
    }

    const activeAssignments = developer.assignments.filter((assignment) =>
      isOccupiedAssignment(assignment, today),
    );
    const assignmentsAtStart = developer.assignments.filter(
      (assignment) =>
        (OCCUPIED_ASSIGNMENT_STATUSES as readonly string[]).includes(assignment.status) &&
        assignment.startDate <= startDate &&
        (assignment.endDate === null || assignment.endDate > startDate),
    );
    const currentAssignment = activeAssignments[0];
    const assignmentAtStart = assignmentsAtStart[0];
    const assignmentEnds = activeAssignments
      .map((assignment) => assignment.endDate)
      .filter((endDate): endDate is Date => endDate !== null);
    const latestAssignmentEnd =
      assignmentEnds.length > 0
        ? new Date(Math.max(...assignmentEnds.map((endDate) => endDate.getTime())))
        : null;
    const endsBeforeStart =
      activeAssignments.length > 0 &&
      activeAssignments.every(
        (assignment) => assignment.endDate && assignment.endDate <= startDate,
      );
    const onBench = activeAssignments.length === 0;
    const availableAtStart = assignmentsAtStart.length === 0 && (onBench || endsBeforeStart);

    if (availableAtStart && onBench) {
      score += 20;
      reasons.push('On bench - available immediately');
    } else if (availableAtStart && endsBeforeStart) {
      score += 15;
      reasons.push(`Current assignment ends ${latestAssignmentEnd?.toISOString().slice(0, 10)}`);
    } else {
      score -= 10;
      const conflictingAssignment = assignmentAtStart ?? currentAssignment;
      reasons.push(
        `Has an assignment at project start (${conflictingAssignment?.client.name ?? 'a client'})`,
      );
    }

    if (industry) {
      const hasIndustry = developer.assignments.some((assignment) =>
        normalize(assignment.client.industry).includes(industry),
      );
      if (hasIndustry) {
        score += 15;
        reasons.push(`Has ${args.industry} experience`);
      }
    }

    if (args.seniority) {
      if (developer.seniority === args.seniority) {
        score += 10;
        reasons.push(`Matches ${args.seniority} level`);
      } else {
        score -= 5;
      }
    }

    const performance = developer.performance[0];
    if (performance?.clientRating && performance.clientRating >= 4) {
      score += 10;
      reasons.push(`High performer (${performance.clientRating}/5)`);
    }
    if (performance && performance.codeQuality >= 90) {
      score += 5;
      reasons.push(`Strong code quality (${performance.codeQuality}/100)`);
    }

    return {
      id: developer.id,
      name: developer.name,
      role: developer.role,
      seniority: developer.seniority,
      score,
      matchedSkills,
      missingSkills,
      reasons,
      available: availableAtStart,
      currentClient: currentAssignment?.client.name ?? 'Bench',
      currentAssignmentEnd: currentAssignment?.endDate ?? null,
      benchSince: developer.benchSince,
    };
  });

  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const teamSize = args.teamSize ?? 1;
  const limit = Math.min(Math.max(teamSize + 2, 5), 20);
  return scored.slice(0, limit);
}

async function getUtilizationHandler(args: z.infer<typeof schemas.get_utilization>) {
  const today = startOfToday();
  const clientId = await resolveClientId({
    clientId: args.clientId ?? undefined,
    clientName: args.clientName ?? undefined,
  });

  const activeAssignment: Prisma.AssignmentWhereInput = {
    ...occupiedAssignmentWhere(today),
    ...(clientId ? { clientId } : {}),
  };

  const where: Prisma.DeveloperWhereInput = {};
  if (args.seniority) where.seniority = args.seniority;
  if (clientId) where.assignments = { some: activeAssignment };

  const developers = await prisma.developer.findMany({
    where,
    include: {
      assignments: {
        where: activeAssignment,
        include: { client: true },
      },
    },
  });

  const total = developers.length;
  const active = developers.filter((developer) => developer.assignments.length > 0).length;
  const onBench = total - active;

  const byClient: Record<string, number> = {};
  const bySeniority: Record<string, { total: number; active: number; bench: number }> = {};

  for (const developer of developers) {
    const isActive = developer.assignments.length > 0;
    const seniority = developer.seniority;

    if (!bySeniority[seniority]) {
      bySeniority[seniority] = { total: 0, active: 0, bench: 0 };
    }
    bySeniority[seniority].total++;
    if (isActive) bySeniority[seniority].active++;
    else bySeniority[seniority].bench++;

    for (const assignment of developer.assignments) {
      byClient[assignment.client.name] = (byClient[assignment.client.name] ?? 0) + 1;
    }
  }

  return {
    total,
    active,
    onBench,
    utilizationRate: total > 0 ? Math.round((active / total) * 100) : 0,
    clientId: clientId ?? null,
    byClient,
    bySeniority,
  };
}

async function checkContractsHandler(args: z.infer<typeof schemas.check_contracts>) {
  const today = startOfToday();
  const where: Prisma.ContractWhereInput = {};

  if (args.status) where.status = args.status;

  const clientId = await resolveClientId({
    clientId: args.clientId ?? undefined,
    clientName: args.clientName ?? undefined,
  });
  if (clientId) where.clientId = clientId;

  if (args.expiringWithin !== null && args.expiringWithin !== undefined) {
    if (!where.status) where.status = { in: ['active', 'renewing'] };
    where.endDate = {
      gte: today,
      lte: addDays(today, args.expiringWithin),
    };
  }

  const contracts = await prisma.contract.findMany({
    where,
    include: { developer: true, client: true },
    orderBy: { endDate: 'asc' },
    take: 50,
  });

  return contracts.map((contract) => {
    const daysUntilExpiry = daysBetween(today, contract.endDate);
    return {
      id: contract.id,
      developerId: contract.developerId,
      developer: contract.developer.name,
      clientId: contract.clientId,
      client: contract.client.name,
      startDate: contract.startDate,
      endDate: contract.endDate,
      billingRate: Number(contract.billingRate),
      status: contract.status,
      daysUntilExpiry,
      isExpired: daysUntilExpiry < 0,
    };
  });
}

async function getPerformanceHandler(args: z.infer<typeof schemas.get_performance>) {
  const today = startOfToday();
  const where: Prisma.PerformanceWhereInput = {};
  const and: Prisma.PerformanceWhereInput[] = [];

  if (args.developerId) and.push({ developerId: args.developerId });
  if (args.period) and.push({ period: args.period });

  const clientId = await resolveClientId({
    clientId: args.clientId ?? undefined,
    clientName: args.clientName ?? undefined,
  });
  if (clientId) {
    const assignments = await prisma.assignment.findMany({
      where: { ...occupiedAssignmentWhere(today), clientId },
      select: { developerId: true },
    });
    and.push({ developerId: { in: [...new Set(assignments.map((a) => a.developerId))] } });
  }

  if (and.length > 0) where.AND = and;

  const performances = await prisma.performance.findMany({
    where,
    include: { developer: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return performances.map((performance) => ({
    developerId: performance.developerId,
    developer: performance.developer.name,
    period: performance.period,
    velocity: performance.velocity,
    prMergeTime: performance.prMergeTime,
    codeQuality: performance.codeQuality,
    clientRating: performance.clientRating,
    notes: performance.notes,
    recordedAt: performance.createdAt,
  }));
}

type Alert = {
  type: 'bench' | 'contract' | 'performance';
  severity: 'high' | 'medium' | 'low';
  message: string;
  data: Record<string, unknown>;
};

async function getAlertsHandler(args: z.infer<typeof schemas.get_alerts>) {
  const today = startOfToday();
  const alerts: Alert[] = [];
  const alertType = args.type ?? 'all';

  if (alertType === 'all' || alertType === 'bench') {
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
      if (daysOnBench > 14) {
        alerts.push({
          type: 'bench',
          severity: daysOnBench > 30 ? 'high' : 'medium',
          message: `${developer.name} has been on the bench for ${daysOnBench} days`,
          data: { developerId: developer.id, daysOnBench, benchSince: developer.benchSince },
        });
      }
    }
  }

  if (alertType === 'all' || alertType === 'contract') {
    const contracts = await prisma.contract.findMany({
      where: {
        status: { in: ['active', 'renewing', 'expired'] },
        startDate: { lte: today },
        // Keep recently expired contracts actionable without retaining every
        // historical expiry as a permanent alert.
        endDate: {
          gte: addDays(today, -30),
          lte: addDays(today, 30),
        },
      },
      include: { developer: true, client: true },
      orderBy: { endDate: 'asc' },
    });

    for (const contract of contracts) {
      const daysLeft = daysBetween(today, contract.endDate);
      const severity: Alert['severity'] = daysLeft < 7 ? 'high' : 'medium';
      const message =
        daysLeft < 0
          ? `${contract.developer.name}'s contract at ${contract.client.name} expired ${Math.abs(
              daysLeft,
            )} days ago`
          : `${contract.developer.name}'s contract at ${contract.client.name} expires in ${daysLeft} days`;

      alerts.push({
        type: 'contract',
        severity,
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

  if (alertType === 'all' || alertType === 'performance') {
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
      if (performance.codeQuality < 80) {
        issues.push(`code quality is ${performance.codeQuality}/100`);
      }
      if (performance.prMergeTime > 3) {
        issues.push(`PR merge time is ${performance.prMergeTime} days`);
      }
      if (performance.clientRating !== null && performance.clientRating < 3.5) {
        issues.push(`client rating is ${performance.clientRating}/5`);
      }
      if (issues.length === 0) continue;

      const severity: Alert['severity'] =
        performance.codeQuality < 70 ||
        performance.prMergeTime > 5 ||
        (performance.clientRating !== null && performance.clientRating < 3)
          ? 'high'
          : 'medium';

      alerts.push({
        type: 'performance',
        severity,
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

  const severityOrder: Record<Alert['severity'], number> = { high: 0, medium: 1, low: 2 };
  alerts.sort(
    (a, b) =>
      severityOrder[a.severity] - severityOrder[b.severity] ||
      a.type.localeCompare(b.type) ||
      a.message.localeCompare(b.message),
  );

  return alerts;
}

// ─── Tool Router ──────────────────────────────────────

function invalidArguments(name: string, error: z.ZodError) {
  const issues = error.issues
    .map((issue) => `${issue.path.join('.') || 'arguments'}: ${issue.message}`)
    .join('; ');
  return { error: `Invalid arguments for ${name}: ${issues}` };
}

export async function executeTool(name: string, args: Record<string, unknown>) {
  try {
    switch (name as ToolName) {
      case 'query_roster': {
        const parsed = schemas.query_roster.safeParse(args);
        return parsed.success
          ? await queryRosterHandler(parsed.data)
          : invalidArguments(name, parsed.error);
      }
      case 'match_developers': {
        const parsed = schemas.match_developers.safeParse(args);
        return parsed.success
          ? await matchDevelopersHandler(parsed.data)
          : invalidArguments(name, parsed.error);
      }
      case 'get_utilization': {
        const parsed = schemas.get_utilization.safeParse(args);
        return parsed.success
          ? await getUtilizationHandler(parsed.data)
          : invalidArguments(name, parsed.error);
      }
      case 'check_contracts': {
        const parsed = schemas.check_contracts.safeParse(args);
        return parsed.success
          ? await checkContractsHandler(parsed.data)
          : invalidArguments(name, parsed.error);
      }
      case 'get_performance': {
        const parsed = schemas.get_performance.safeParse(args);
        return parsed.success
          ? await getPerformanceHandler(parsed.data)
          : invalidArguments(name, parsed.error);
      }
      case 'get_alerts': {
        const parsed = schemas.get_alerts.safeParse(args);
        return parsed.success
          ? await getAlertsHandler(parsed.data)
          : invalidArguments(name, parsed.error);
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Tool execution failed',
    };
  }
}
