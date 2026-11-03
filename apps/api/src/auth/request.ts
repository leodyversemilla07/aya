import type { AuthSession } from '@workspace/auth';
import type { Request } from 'express';

export type AuthenticatedRequest = Request & {
  auth?: AuthSession;
};
