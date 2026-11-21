'use client';

import { authClient } from '@workspace/auth/client';
import { type UserRole, normalizeUserRole } from '@workspace/auth/roles';

export interface WorkspaceAccess {
  role: UserRole;
  canManage: boolean;
  isAdmin: boolean;
  loading: boolean;
  refetch: () => Promise<unknown>;
}

export function useWorkspaceAccess(): WorkspaceAccess {
  const { data, isPending, refetch } = authClient.useSession();
  const role = normalizeUserRole((data?.user as { role?: unknown } | undefined)?.role);

  return {
    role,
    canManage: role === 'admin' || role === 'manager',
    isAdmin: role === 'admin',
    loading: isPending,
    refetch: async () => refetch(),
  };
}
