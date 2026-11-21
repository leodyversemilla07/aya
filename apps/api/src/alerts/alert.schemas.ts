import { z } from 'zod';

export const alertListQuerySchema = z.object({
  status: z.enum(['open', 'resolved', 'all']).default('open'),
  type: z.enum(['all', 'bench', 'contract', 'performance']).default('all'),
  severity: z.enum(['all', 'high', 'medium', 'low']).default('all'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const alertDeliveryListQuerySchema = z.object({
  status: z.enum(['all', 'pending', 'processing', 'succeeded', 'failed']).default('all'),
  event: z.enum(['all', 'opened', 'updated', 'reopened', 'resolved']).default('all'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});
