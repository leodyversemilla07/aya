import type { AuthSession } from '@workspace/auth';
import type { Request } from 'express';

export type AuthenticatedRequest = Request & {
  auth?: AuthSession;
  /** Stable user:<id> or api-key:<sha256> ownership scope. */
  authSubject?: string;
  authType?: 'session' | 'api-key';
  requestId?: string;
};
