'use client';

import { apiRequest } from '@/lib/api';
import { developerQuery } from '@/lib/queries';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { ArrowLeft, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DeveloperFormDialog } from './developer-form';
import {
  ConfirmDelete,
  LoadingRows,
  ManagementPage,
  QueryError,
  StatusBadge,
  formatDate,
  formatMoney,
} from './ui';

export function DeveloperDetailPage({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const { data, isPending, error } = useQuery(developerQuery(id));

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest(`/developers/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['developers'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      router.push('/developers');
    },
  });

  const back = (
    <Button type="button" variant="ghost" size="sm" asChild>
      <Link href="/developers">
        <ArrowLeft />
        Back to developers
      </Link>
    </Button>
  );

  if (isPending) {
    return (
      <ManagementPage title="Developer" subtitle="Roster management">
        {back}
        <Card>
          <LoadingRows label="Loading developer…" />
        </Card>
      </ManagementPage>
    );
  }

  if (error || !data) {
    return (
      <ManagementPage title="Developer" subtitle="Roster management">
        {back}
        <QueryError message={error?.message ?? 'Developer was not found.'} />
      </ManagementPage>
    );
  }

  return (
    <ManagementPage
      title={data.name}
      subtitle="Developer profile"
      description={`${data.role} · ${data.seniority}`}
      action={
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil />
            Edit
          </Button>
          <ConfirmDelete
            showLabel
            title="Delete developer?"
            description={`${data.name} and all related records will be permanently deleted.`}
            pending={deleteMutation.isPending}
            onConfirm={() => deleteMutation.mutate()}
          />
        </div>
      }
    >
      <div>{back}</div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Email</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">{data.email}</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Seniority</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="capitalize">
              {data.seniority}
            </Badge>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Availability</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            {data.onBench
              ? data.benchSince
                ? `On bench since ${formatDate(data.benchSince)}`
                : 'On bench'
              : data.currentAssignment
                ? `Assigned to ${data.currentAssignment.clientName}`
                : 'Assigned'}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Skills</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">{data.skills.length} tracked</CardContent>
        </Card>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Skills</h2>
        <Card>
          <CardContent className="flex flex-wrap gap-2 pt-4">
            {data.skills.length === 0 ? (
              <p className="text-sm text-muted-foreground">No skills recorded.</p>
            ) : (
              data.skills.map((skill) => (
                <Badge key={skill.id} variant="secondary">
                  {skill.name} · {skill.level} · {skill.yearsExp}y
                </Badge>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Assignments</h2>
        <Card className="overflow-hidden py-0">
          {data.assignments.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No assignments.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">{assignment.projectName}</TableCell>
                    <TableCell>{assignment.client.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(assignment.startDate)} →{' '}
                      {assignment.endDate ? formatDate(assignment.endDate) : 'Open-ended'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={assignment.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Contracts</h2>
        <Card className="overflow-hidden py-0">
          {data.contracts.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No contracts.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">{contract.client.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(contract.startDate)} → {formatDate(contract.endDate)}
                    </TableCell>
                    <TableCell>{formatMoney(contract.billingRate)}</TableCell>
                    <TableCell>
                      <StatusBadge status={contract.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Performance</h2>
        <Card className="overflow-hidden py-0">
          {data.performance.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No performance records.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Velocity</TableHead>
                  <TableHead>PR merge</TableHead>
                  <TableHead>Code quality</TableHead>
                  <TableHead>Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.performance.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.period}</TableCell>
                    <TableCell>{record.velocity}</TableCell>
                    <TableCell>{record.prMergeTime}d</TableCell>
                    <TableCell>{record.codeQuality}/100</TableCell>
                    <TableCell>{record.clientRating ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </section>

      <DeveloperFormDialog open={editOpen} onOpenChange={setEditOpen} developer={data} />
    </ManagementPage>
  );
}
