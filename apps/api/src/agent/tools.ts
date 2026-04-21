import { prisma } from '@workspace/db';
import { z } from 'zod';

// ─── Tool Definitions (Vercel AI SDK format) ──────────

export const tools = {
  query_roster: {
    description: 'Search developers by skills, availability, seniority, or current client',
    parameters: z.object({
      skills: z.array(z.string()).optional().describe('Filter by skill names'),
      availableAfter: z.string().optional().describe('Available after this date (YYYY-MM-DD)'),
      seniority: z.string().optional().describe('Filter by seniority: junior, mid, senior, lead'),
      currentClient: z.string().optional().describe('Filter by current client name'),
      onBench: z.boolean().optional().describe('True = only bench devs, false = only assigned'),
    }),
  },
  match_developers: {
    description: 'Find the best developer matches for a new project requirement',
    parameters: z.object({
      requiredSkills: z.array(z.string()).describe('Required skill names'),
      seniority: z.string().optional().describe('Preferred seniority level'),
      startDate: z.string().describe('When the project starts (YYYY-MM-DD)'),
      teamSize: z.number().optional().default(1).describe('How many devs needed'),
      industry: z.string().optional().describe('Prefer devs with experience in this industry'),
    }),
  },
  get_utilization: {
    description: 'Get team utilization metrics - how many devs are active vs on bench',
    parameters: z.object({
      clientId: z.string().optional().describe('Filter by specific client'),
      seniority: z.string().optional().describe('Filter by seniority'),
    }),
  },
  check_contracts: {
    description: 'Check contract status and upcoming renewals',
    parameters: z.object({
      expiringWithin: z.number().optional().describe('Show contracts expiring within N days'),
      clientId: z.string().optional().describe('Filter by client'),
      status: z.string().optional().describe('Filter by status: active, renewing, expired'),
    }),
  },
  get_performance: {
    description: 'Get developer or team performance data',
    parameters: z.object({
      developerId: z.string().optional().describe('Specific developer ID'),
      clientId: z.string().optional().describe('All devs at a client'),
      period: z.string().optional().describe("Period like '2026-Q1'"),
    }),
  },
  get_alerts: {
    description:
      'Get proactive alerts about risks: bench time, contract expiry, performance issues',
    parameters: z.object({
      type: z.enum(['all', 'bench', 'contract', 'performance']).optional().default('all'),
    }),
  },
};

// ─── Tool Handlers ─────────────────────────────────────

async function queryRosterHandler(args: Record<string, unknown>) {
  const where: Record<string, unknown> = {};

  if (args.seniority) where.seniority = args.seniority;
  if (args.onBench === true) where.benchSince = { not: null };
  if (args.onBench === false) where.benchSince = null;

  if (args.skills && (args.skills as string[]).length > 0) {
    where.skills = { some: { name: { in: args.skills as string[] } } };
  }

  if (args.currentClient) {
    where.assignments = {
      some: {
        status: 'active',
        client: { name: { contains: args.currentClient as string } },
      },
    };
  }

  if (args.availableAfter) {
    const date = new Date(args.availableAfter as string);
    where.OR = [
      { benchSince: { not: null } },
      { assignments: { some: { endDate: { lte: date }, status: 'active' } } },
    ];
  }

  const devs = await prisma.developer.findMany({
    where,
    include: {
      skills: true,
      assignments: { where: { status: 'active' }, include: { client: true } },
      contracts: { where: { status: 'active' } },
    },
    take: 20,
  });

  return devs.map((d) => ({
    id: d.id,
    name: d.name,
    role: d.role,
    seniority: d.seniority,
    skills: d.skills.map((s) => `${s.name} (${s.level}, ${s.yearsExp}y)`),
    currentClient: d.assignments[0]?.client?.name || 'Bench',
    currentProject: d.assignments[0]?.projectName || null,
    onBench: !!d.benchSince,
    benchSince: d.benchSince,
  }));
}

async function matchDevelopersHandler(args: Record<string, unknown>) {
  const requiredSkills = args.requiredSkills as string[];
  const startDate = new Date(args.startDate as string);
  const industry = args.industry as string | undefined;

  const devs = await prisma.developer.findMany({
    include: {
      skills: true,
      assignments: { include: { client: true } },
      contracts: { where: { status: 'active' } },
      performance: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  const scored = devs.map((dev) => {
    let score = 0;
    const reasons: string[] = [];

    // Skill matching
    for (const req of requiredSkills) {
      const match = dev.skills.find((s) => s.name.toLowerCase() === req.toLowerCase());
      if (match) {
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
    }

    // Availability
    const isOnBench = !!dev.benchSince;
    const finishesBeforeStart = dev.assignments.some(
      (a) => a.endDate && a.endDate <= startDate && a.status === 'active',
    );
    if (isOnBench) {
      score += 20;
      reasons.push('On bench - available immediately');
    } else if (finishesBeforeStart) {
      score += 15;
      reasons.push('Assignment ending before start date');
    }

    // Industry experience
    if (industry) {
      const hasIndustry = dev.assignments.some(
        (a) => a.client.industry.toLowerCase() === industry.toLowerCase(),
      );
      if (hasIndustry) {
        score += 15;
        reasons.push(`Has ${industry} experience`);
      }
    }

    // Seniority match
    if (args.seniority && dev.seniority === args.seniority) {
      score += 10;
      reasons.push(`Matches ${args.seniority} level`);
    }

    // Performance bonus
    const perf = dev.performance[0];
    if (perf?.clientRating && perf.clientRating >= 4) {
      score += 10;
      reasons.push(`High performer (${perf.clientRating}/5)`);
    }

    return {
      id: dev.id,
      name: dev.name,
      role: dev.role,
      seniority: dev.seniority,
      score,
      reasons,
      available: isOnBench || finishesBeforeStart,
      currentClient: dev.assignments.find((a) => a.status === 'active')?.client?.name || 'Bench',
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, args.teamSize ? (args.teamSize as number) + 2 : 5);
}

async function getUtilizationHandler(args: Record<string, unknown>) {
  const where: Record<string, unknown> = {};
  if (args.seniority) where.seniority = args.seniority;

  const devs = await prisma.developer.findMany({
    where,
    include: {
      assignments: {
        where: { status: 'active' },
        include: { client: true },
      },
    },
  });

  const total = devs.length;
  const onBench = devs.filter((d) => !!d.benchSince).length;
  const active = total - onBench;

  const byClient: Record<string, number> = {};
  for (const dev of devs) {
    for (const a of dev.assignments) {
      byClient[a.client.name] = (byClient[a.client.name] || 0) + 1;
    }
  }

  const bySeniority: Record<string, { total: number; active: number; bench: number }> = {};
  for (const dev of devs) {
    if (!bySeniority[dev.seniority]) bySeniority[dev.seniority] = { total: 0, active: 0, bench: 0 };
    bySeniority[dev.seniority].total++;
    if (dev.benchSince) bySeniority[dev.seniority].bench++;
    else bySeniority[dev.seniority].active++;
  }

  return {
    total,
    active,
    onBench,
    utilizationRate: total > 0 ? `${Math.round((active / total) * 100)}%` : 'N/A',
    byClient,
    bySeniority,
  };
}

async function checkContractsHandler(args: Record<string, unknown>) {
  const where: Record<string, unknown> = {};

  if (args.status) where.status = args.status;
  if (args.clientId) where.clientId = args.clientId;

  if (args.expiringWithin) {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + (args.expiringWithin as number));
    where.endDate = { gte: now, lte: future };
  }

  const contracts = await prisma.contract.findMany({
    where,
    include: { developer: true, client: true },
    orderBy: { endDate: 'asc' },
    take: 20,
  });

  return contracts.map((c) => ({
    id: c.id,
    developer: c.developer.name,
    client: c.client.name,
    startDate: c.startDate,
    endDate: c.endDate,
    billingRate: c.billingRate,
    status: c.status,
    daysUntilExpiry: Math.ceil((c.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  }));
}

async function getPerformanceHandler(args: Record<string, unknown>) {
  const where: Record<string, unknown> = {};
  if (args.developerId) where.developerId = args.developerId;
  if (args.period) where.period = args.period;

  if (args.clientId) {
    const assignments = await prisma.assignment.findMany({
      where: { clientId: args.clientId as string, status: 'active' },
      select: { developerId: true },
    });
    where.developerId = { in: assignments.map((a) => a.developerId) };
  }

  const perfs = await prisma.performance.findMany({
    where,
    include: { developer: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return perfs.map((p) => ({
    developer: p.developer.name,
    period: p.period,
    velocity: p.velocity,
    prMergeTime: p.prMergeTime,
    codeQuality: p.codeQuality,
    clientRating: p.clientRating,
    notes: p.notes,
  }));
}

async function getAlertsHandler(args: Record<string, unknown>) {
  const alerts: Array<{ type: string; severity: string; message: string; data: unknown }> = [];

  // Bench alerts (>14 days)
  const benchDevs = await prisma.developer.findMany({
    where: { benchSince: { not: null } },
  });
  for (const dev of benchDevs) {
    const daysOnBench = Math.ceil((Date.now() - dev.benchSince!.getTime()) / (1000 * 60 * 60 * 24));
    if (daysOnBench > 14) {
      alerts.push({
        type: 'bench',
        severity: daysOnBench > 30 ? 'high' : 'medium',
        message: `${dev.name} has been on bench for ${daysOnBench} days`,
        data: { developerId: dev.id, daysOnBench },
      });
    }
  }

  // Contract expiry alerts (next 14 days)
  const now = new Date();
  const twoWeeks = new Date();
  twoWeeks.setDate(twoWeeks.getDate() + 14);

  const expiringContracts = await prisma.contract.findMany({
    where: {
      status: 'active',
      endDate: { gte: now, lte: twoWeeks },
    },
    include: { developer: true, client: true },
  });
  for (const c of expiringContracts) {
    const daysLeft = Math.ceil((c.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    alerts.push({
      type: 'contract',
      severity: daysLeft < 7 ? 'high' : 'medium',
      message: `${c.developer.name}'s contract at ${c.client.name} expires in ${daysLeft} days`,
      data: { contractId: c.id, daysLeft },
    });
  }

  return alerts;
}

// ─── Tool Router ───────────────────────────────────────

const toolHandlers: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  query_roster: queryRosterHandler,
  match_developers: matchDevelopersHandler,
  get_utilization: getUtilizationHandler,
  check_contracts: checkContractsHandler,
  get_performance: getPerformanceHandler,
  get_alerts: getAlertsHandler,
};

export async function executeTool(name: string, args: Record<string, unknown>) {
  const handler = toolHandlers[name];
  if (!handler) return { error: `Unknown tool: ${name}` };
  try {
    return await handler(args);
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Tool execution failed' };
  }
}
