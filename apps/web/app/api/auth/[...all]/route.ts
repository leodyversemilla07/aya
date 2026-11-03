import { authHandlers } from '@workspace/auth/next';

export const runtime = 'nodejs';

export const { GET, POST } = authHandlers;
