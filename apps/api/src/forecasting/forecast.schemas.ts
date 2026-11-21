import { z } from 'zod';
import { DEFAULT_HORIZON_WEEKS, MAX_HORIZON_WEEKS } from './forecast';

export const forecastQuerySchema = z.object({
  weeks: z.coerce.number().int().min(1).max(MAX_HORIZON_WEEKS).default(DEFAULT_HORIZON_WEEKS),
  clientId: z.string().trim().min(1).optional(),
});
