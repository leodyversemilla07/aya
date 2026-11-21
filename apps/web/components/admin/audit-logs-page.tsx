'use client';

import { apiRequest } from '@/lib/api';
import type { AuditLogRecord, Paginated } from '@/lib/types';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@workspace/ui/components/badge';
import { Card } from '@workspace/ui/components/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { EmptyRows, LoadingRows, ManagementPage, QueryError } from '../management/ui';

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function statePreview(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value !== 'object') return String(value);
  const record = value as Record<string, unknown>;
  return Object.entries(record)
    .slice(0, 4)
    .map(([key, nestedValue]) => `${key}: ${String(nestedValue ?? '—')}`)
    .join(', ');
}

export function AuditLogsPage() {
  const logs = useQuery({
    queryKey: ['admin', 'audit-logs'],
    queryFn: () => apiRequest<Paginated<AuditLogRecord>>('/admin/audit-logs?limit=200'),
  });

  return (
    <ManagementPage
      title="Audit log"
      subtitle="Administrative history"
      description="Review staffing and access changes made through the API."
    >
      <Card className="overflow-hidden py-0">
        {logs.isPending ? (
          <LoadingRows label="Loading audit history…" />
        ) : logs.error ? (
          <QueryError message={logs.error.message} />
        ) : !logs.data || logs.data.items.length === 0 ? (
          <EmptyRows message="No audit events have been recorded yet." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Changes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.data.items.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatTimestamp(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{log.actorName}</p>
                      <p className="text-xs text-muted-foreground">{log.actorType}</p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.action === 'delete'
                            ? 'destructive'
                            : log.action === 'create'
                              ? 'default'
                              : 'secondary'
                        }
                      >
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium capitalize">{log.entityType}</p>
                      <p className="max-w-48 truncate font-mono text-xs text-muted-foreground">
                        {log.entityId}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="truncate text-xs text-muted-foreground">
                        {statePreview(log.after ?? log.before)}
                      </p>
                      {log.requestId ? (
                        <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                          {log.requestId}
                        </p>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t px-3 py-2 text-xs text-muted-foreground">
              Showing {logs.data.items.length} of {logs.data.total} audit events
            </div>
          </>
        )}
      </Card>
    </ManagementPage>
  );
}
