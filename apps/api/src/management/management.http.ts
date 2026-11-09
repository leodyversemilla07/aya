import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@workspace/db';
import type { z } from 'zod';

/** Validates a request body/query and reports every issue in one 400 response. */
export function parseOrThrow<Schema extends z.ZodTypeAny>(
  schema: Schema,
  value: unknown,
): z.infer<Schema> {
  const parsed = schema.safeParse(value ?? {});
  if (!parsed.success) {
    throw new BadRequestException({
      message: parsed.error.issues.map((issue) => {
        const path = issue.path.join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
      }),
      error: 'Bad Request',
    });
  }
  return parsed.data;
}

/**
 * Maps Prisma's known request errors to meaningful HTTP responses instead of
 * leaking database internals. P2002 = unique constraint, P2003 = foreign key,
 * P2025 = record not found.
 */
export function rethrowPrismaError(error: unknown, entity: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(', ')
        : String(error.meta?.target ?? 'a unique field');
      throw new ConflictException(`${entity} already exists (${target}).`);
    }
    if (error.code === 'P2003') {
      throw new BadRequestException(`${entity} references a record that does not exist.`);
    }
    if (error.code === 'P2025') {
      throw new NotFoundException(`${entity} was not found.`);
    }
  }
  throw error;
}

export function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function emptyTextToNull(value: string | null | undefined): string | null {
  return emptyToNull(value);
}
