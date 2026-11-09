'use client';

import { apiRequest } from '@/lib/api';
import { developersQuery, performanceQuery } from '@/lib/queries';
import type { PerformanceRecord } from '@/lib/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@workspace/ui/components/button';
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
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { PerformanceFormDialog } from './performance-form';
import { ConfirmDelete, EmptyRows, LoadingRows, ManagementPage, QueryError } from './ui';

export function PerformancePage() {
  const [developerId, setDeveloperId] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PerformanceRecord | null>(null);

  const queryClient = useQueryClient();
  const developers = useQuery(developersQuery({ limit: 200 }));
  const { data, isPending, error } = useQuery(
    performanceQuery({
      developerId: developerId === 'all' ? undefined : developerId,
      limit: 200,
    }),
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/performance/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['performance'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return (
    <ManagementPage
      title="Performance"
      subtitle="Team health"
      description="Record velocity, review turnaround, code quality, and client ratings."
      action={
        <Button
          type="button"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus />
          Add record
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Select value={developerId} onValueChange={setDeveloperId}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All developers</SelectItem>
            {developers.data?.items.map((developer) => (
              <SelectItem key={developer.id} value={developer.id}>
                {developer.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden py-0">
        {isPending ? (
          <LoadingRows label="Loading performance records…" />
        ) : error ? (
          <QueryError message={error.message} />
        ) : !data || data.items.length === 0 ? (
          <EmptyRows message="No performance records match these filters." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Developer</TableHead>
                  <TableHead>Velocity</TableHead>
                  <TableHead>PR merge time</TableHead>
                  <TableHead>Code quality</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.period}</TableCell>
                    <TableCell>{record.developer.name}</TableCell>
                    <TableCell>{record.velocity}</TableCell>
                    <TableCell>{record.prMergeTime}d</TableCell>
                    <TableCell
                      className={
                        record.codeQuality < 80 ? 'text-amber-600 dark:text-amber-400' : undefined
                      }
                    >
                      {record.codeQuality}/100
                    </TableCell>
                    <TableCell>{record.clientRating ?? '—'}</TableCell>
                    <TableCell className="max-w-56 truncate text-xs text-muted-foreground">
                      {record.notes ?? '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${record.period} record for ${record.developer.name}`}
                          onClick={() => {
                            setEditing(record);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil />
                        </Button>
                        <ConfirmDelete
                          title="Delete performance record?"
                          description={`The ${record.period} record for ${record.developer.name} will be permanently deleted.`}
                          pending={
                            deleteMutation.isPending && deleteMutation.variables === record.id
                          }
                          onConfirm={() => deleteMutation.mutate(record.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t px-3 py-2 text-xs text-muted-foreground">
              Showing {data.items.length} of {data.total} records
            </div>
          </>
        )}
      </Card>

      <PerformanceFormDialog open={dialogOpen} onOpenChange={setDialogOpen} performance={editing} />
    </ManagementPage>
  );
}
