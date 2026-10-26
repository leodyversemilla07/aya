import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as publicly accessible. API-key authentication is skipped for
 * these routes (useful for health checks and the service root).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
