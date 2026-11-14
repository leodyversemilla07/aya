import { z } from 'zod';
import { findDuplicateSkillNames } from '../domain/skills';

export const SENIORITIES = ['junior', 'mid', 'senior', 'lead'] as const;
export const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const;
export const CONTRACT_STATUSES = ['active', 'renewing', 'expired'] as const;
export const ASSIGNMENT_STATUSES = ['active', 'ending', 'transition', 'completed'] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Accepts a calendar date in YYYY-MM-DD form and converts it to a UTC Date.
 * Date normalizes impossible values (for example 2026-02-31), so the input is
 * round-tripped to reject them.
 */
export const dateSchema = z
  .string()
  .trim()
  .regex(DATE_PATTERN, 'Use YYYY-MM-DD')
  .transform((value, context) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      context.addIssue({ code: 'custom', message: `${value} is not a valid date.` });
      return z.NEVER;
    }
    return date;
  });

const optionalDateSchema = z.union([dateSchema, z.null()]).optional();

const optionalUrlSchema = z
  .union([z.literal(''), z.string().trim().url('Must be a valid URL').max(2048)])
  .nullish();

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const booleanQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

const requiredText = z.string().trim().min(1).max(120);

// ─── Developers ───────────────────────────────────────

export const skillInputSchema = z.object({
  name: requiredText,
  level: z.enum(SKILL_LEVELS),
  yearsExp: z.number().int().min(0).max(60),
});

const skillListSchema = z.array(skillInputSchema).max(50);

/**
 * The agent matches skills by their canonical name, so "Node.js" and "node js"
 * are the same skill. Rejecting those collisions here keeps a developer from
 * accumulating duplicate rows that read as one skill.
 */
function rejectDuplicateSkills(
  skills: { name: string }[] | undefined,
  context: z.RefinementCtx,
): void {
  if (!skills) return;
  for (const duplicate of findDuplicateSkillNames(skills.map((skill) => skill.name))) {
    context.addIssue({
      code: 'custom',
      message: `Duplicate skill "${duplicate}".`,
      path: ['skills'],
    });
  }
}

export const developerCreateSchema = z
  .object({
    name: requiredText,
    email: z.string().trim().email('Must be a valid email').max(254),
    role: requiredText,
    seniority: z.enum(SENIORITIES),
    avatarUrl: optionalUrlSchema,
    benchSince: optionalDateSchema,
    skills: skillListSchema.default([]),
  })
  .superRefine((value, context) => rejectDuplicateSkills(value.skills, context));

export const developerUpdateSchema = z
  .object({
    name: requiredText.optional(),
    email: z.string().trim().email('Must be a valid email').max(254).optional(),
    role: requiredText.optional(),
    seniority: z.enum(SENIORITIES).optional(),
    avatarUrl: optionalUrlSchema,
    benchSince: optionalDateSchema,
    // Deliberately not derived from the create schema: a default here would
    // replace the developer's skills on every partial update.
    skills: skillListSchema.optional(),
  })
  .superRefine((value, context) => rejectDuplicateSkills(value.skills, context));

export const developerListQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  seniority: z.enum(SENIORITIES).optional(),
  skill: z.string().trim().max(120).optional(),
  clientId: z.string().trim().min(1).optional(),
  onBench: booleanQuery,
});

// ─── Clients ──────────────────────────────────────────

export const contactInputSchema = z.object({
  name: requiredText,
  role: requiredText,
  email: z.string().trim().email('Must be a valid email').max(254),
  phone: z.string().trim().max(40).nullish(),
});

export const clientCreateSchema = z.object({
  name: requiredText,
  industry: requiredText,
  logoUrl: optionalUrlSchema,
  contacts: z.array(contactInputSchema).max(50).default([]),
});

export const clientUpdateSchema = clientCreateSchema.partial();

export const clientListQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  industry: z.string().trim().max(120).optional(),
});

// ─── Contracts ────────────────────────────────────────

export const contractCreateSchema = z
  .object({
    developerId: z.string().trim().min(1),
    clientId: z.string().trim().min(1),
    startDate: dateSchema,
    endDate: dateSchema,
    billingRate: z.number().min(0).max(10_000_000),
    status: z.enum(CONTRACT_STATUSES).default('active'),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: 'endDate must be on or after startDate.',
    path: ['endDate'],
  });

export const contractUpdateSchema = z
  .object({
    developerId: z.string().trim().min(1).optional(),
    clientId: z.string().trim().min(1).optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    billingRate: z.number().min(0).max(10_000_000).optional(),
    status: z.enum(CONTRACT_STATUSES).optional(),
  })
  .refine(
    (value) =>
      value.startDate === undefined ||
      value.endDate === undefined ||
      value.endDate >= value.startDate,
    { message: 'endDate must be on or after startDate.', path: ['endDate'] },
  );

export const contractListQuerySchema = paginationSchema.extend({
  status: z.enum(CONTRACT_STATUSES).optional(),
  clientId: z.string().trim().min(1).optional(),
  developerId: z.string().trim().min(1).optional(),
  expiringWithin: z.coerce.number().int().min(0).max(365).optional(),
});

// ─── Assignments ──────────────────────────────────────

export const assignmentCreateSchema = z
  .object({
    developerId: z.string().trim().min(1),
    clientId: z.string().trim().min(1),
    projectName: requiredText,
    status: z.enum(ASSIGNMENT_STATUSES).default('active'),
    startDate: dateSchema,
    endDate: optionalDateSchema,
    jiraBoardUrl: optionalUrlSchema,
    githubRepoUrl: optionalUrlSchema,
  })
  .refine((value) => !value.endDate || value.endDate >= value.startDate, {
    message: 'endDate must be on or after startDate.',
    path: ['endDate'],
  });

export const assignmentUpdateSchema = z
  .object({
    developerId: z.string().trim().min(1).optional(),
    clientId: z.string().trim().min(1).optional(),
    projectName: requiredText.optional(),
    status: z.enum(ASSIGNMENT_STATUSES).optional(),
    startDate: dateSchema.optional(),
    endDate: optionalDateSchema,
    jiraBoardUrl: optionalUrlSchema,
    githubRepoUrl: optionalUrlSchema,
  })
  .refine(
    (value) =>
      value.startDate === undefined ||
      value.endDate === undefined ||
      value.endDate === null ||
      value.endDate >= value.startDate,
    { message: 'endDate must be on or after startDate.', path: ['endDate'] },
  );

export const assignmentListQuerySchema = paginationSchema.extend({
  status: z.enum(ASSIGNMENT_STATUSES).optional(),
  clientId: z.string().trim().min(1).optional(),
  developerId: z.string().trim().min(1).optional(),
  active: booleanQuery,
});

// ─── Performance ──────────────────────────────────────

const periodSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(Q[1-4]|0[1-9]|1[0-2])$/, "Use 'YYYY-Q1' or 'YYYY-MM'");

export const performanceCreateSchema = z.object({
  developerId: z.string().trim().min(1),
  period: periodSchema,
  velocity: z.number().min(0).max(10_000),
  prMergeTime: z.number().min(0).max(365),
  codeQuality: z.number().min(0).max(100),
  clientRating: z.number().min(1).max(5).nullish(),
  notes: z.string().trim().max(2000).nullish(),
});

export const performanceUpdateSchema = performanceCreateSchema.partial();

export const performanceListQuerySchema = paginationSchema.extend({
  developerId: z.string().trim().min(1).optional(),
  period: z.string().trim().max(20).optional(),
});
