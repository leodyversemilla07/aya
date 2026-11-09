'use client';

import { apiRequest } from '@/lib/api';
import { assignmentsQuery } from '@/lib/queries';
import type { AssignmentRecord } from '@/lib/types';
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
import { AssignmentFormDialog } from './assignment-form';
import {
  ConfirmDelete,
  EmptyRows,
  LoadingRows,
  ManagementPage,
  QueryError,
  StatusBadge,
  formatDate,
} from './ui';

const STATUSES = ['active', 'ending', 'transition', 'completed'] as const;

export function AssignmentsPage() {
  const [status, setStatus] = useState('all');
  const [active, setActive] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AssignmentRecord | null>(null);

  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery(
    assignmentsQuery({
      status: status === 'all' ? undefined : status,
      active: active === 'all' ? undefined : active === 'true',
      limit: 200,
    }),
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/assignments/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['assignments'] });
      await queryClient.invalidateQueries({ queryKey: ['developers'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return (
    <ManagementPage
      title="Assignments"
      subtitle="Delivery management"
      description="See who is on which project and manage assignment windows."
      action={
        <Button
          type="button"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus />
          Add assignment
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((value) => (
              <SelectItem key={value} value={value} className="capitalize">
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={active} onValueChange={setActive}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignments</SelectItem>
            <SelectItem value="true">Currently active</SelectItem>
            <SelectItem value="false">Not active</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden py-0">
        {isPending ? (
          <LoadingRows label="Loading assignments…" />
        ) : error ? (
          <QueryError message={error.message} />
        ) : !data || data.items.length === 0 ? (
          <EmptyRows message="No assignments match these filters." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Developer</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">{assignment.projectName}</TableCell>
                    <TableCell>{assignment.developer.name}</TableCell>
                    <TableCell>{assignment.client.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(assignment.startDate)} →{' '}
                      {assignment.endDate ? formatDate(assignment.endDate) : 'Open-ended'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={assignment.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${assignment.projectName}`}
                          onClick={() => {
                            setEditing(assignment);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil />
                        </Button>
                        <ConfirmDelete
                          title="Delete assignment?"
                          description={`${assignment.projectName} for ${assignment.developer.name} will be permanently deleted.`}
                          pending={
                            deleteMutation.isPending && deleteMutation.variables === assignment.id
                          }
                          onConfirm={() => deleteMutation.mutate(assignment.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t px-3 py-2 text-xs text-muted-foreground">
              Showing {data.items.length} of {data.total} assignments
            </div>
          </>
        )}
      </Card>

      <AssignmentFormDialog open={dialogOpen} onOpenChange={setDialogOpen} assignment={editing} />
    </ManagementPage>
  );
}
