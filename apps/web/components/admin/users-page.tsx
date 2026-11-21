'use client';

import { useWorkspaceAccess } from '@/lib/access';
import { apiRequest } from '@/lib/api';
import type { Paginated, WorkspaceUserRecord } from '@/lib/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@workspace/ui/components/badge';
import { Card } from '@workspace/ui/components/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { Loader2 } from 'lucide-react';
import { EmptyRows, LoadingRows, ManagementPage, QueryError, formatDate } from '../management/ui';

const ROLE_DESCRIPTIONS = {
  admin: 'Full access, including user roles and audit history.',
  manager: 'Can create, update, and delete staffing records.',
  viewer: 'Read-only access to staffing data and Aya.',
} as const;

export function UsersPage() {
  const { refetch: refetchSession } = useWorkspaceAccess();
  const queryClient = useQueryClient();
  const users = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => apiRequest<Paginated<WorkspaceUserRecord>>('/admin/users?limit=200'),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: WorkspaceUserRecord['role'] }) =>
      apiRequest<WorkspaceUserRecord>(`/admin/users/${id}/role`, {
        method: 'PATCH',
        body: { role },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      await refetchSession();
    },
  });

  return (
    <ManagementPage
      title="Users"
      subtitle="Workspace access"
      description="Assign workspace roles. Administrators always retain full access."
    >
      {roleMutation.isError ? <QueryError message={roleMutation.error.message} /> : null}

      <Card className="overflow-hidden py-0">
        {users.isPending ? (
          <LoadingRows label="Loading users…" />
        ) : users.error ? (
          <QueryError message={users.error.message} />
        ) : !users.data || users.data.items.length === 0 ? (
          <EmptyRows message="No users match this workspace." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data.items.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={user.role}
                          disabled={
                            roleMutation.isPending && roleMutation.variables?.id === user.id
                          }
                          onValueChange={(role) =>
                            roleMutation.mutate({
                              id: user.id,
                              role: role as WorkspaceUserRecord['role'],
                            })
                          }
                        >
                          <SelectTrigger className="w-36" aria-label={`Role for ${user.email}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                        {roleMutation.isPending && roleMutation.variables?.id === user.id ? (
                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        ) : null}
                      </div>
                      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                        {ROLE_DESCRIPTIONS[user.role]}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{formatDate(user.createdAt)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t px-3 py-2 text-xs text-muted-foreground">
              Showing {users.data.items.length} of {users.data.total} users
            </div>
          </>
        )}
      </Card>
    </ManagementPage>
  );
}
