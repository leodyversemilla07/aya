'use client';

import { apiRequest } from '@/lib/api';
import { clientQuery } from '@/lib/queries';
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
import { ClientFormDialog } from './client-form';
import {
  ConfirmDelete,
  LoadingRows,
  ManagementPage,
  QueryError,
  StatusBadge,
  formatDate,
  formatMoney,
} from './ui';

export function ClientDetailPage({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const { data, isPending, error } = useQuery(clientQuery(id));

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest(`/clients/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      router.push('/clients');
    },
  });

  const back = (
    <Button type="button" variant="ghost" size="sm" asChild>
      <Link href="/clients">
        <ArrowLeft />
        Back to clients
      </Link>
    </Button>
  );

  if (isPending) {
    return (
      <ManagementPage title="Client" subtitle="Account management">
        {back}
        <Card>
          <LoadingRows label="Loading client…" />
        </Card>
      </ManagementPage>
    );
  }

  if (error || !data) {
    return (
      <ManagementPage title="Client" subtitle="Account management">
        {back}
        <QueryError message={error?.message ?? 'Client was not found.'} />
      </ManagementPage>
    );
  }

  return (
    <ManagementPage
      title={data.name}
      subtitle="Client profile"
      description={data.industry}
      action={
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil />
            Edit
          </Button>
          <ConfirmDelete
            showLabel
            title="Delete client?"
            description={`${data.name} and all related contacts, assignments, and contracts will be permanently deleted.`}
            pending={deleteMutation.isPending}
            onConfirm={() => deleteMutation.mutate()}
          />
        </div>
      }
    >
      <div>{back}</div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Industry</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="capitalize">
              {data.industry}
            </Badge>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">{data.contacts.length}</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Contracts</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">{data.contracts.length}</CardContent>
        </Card>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Contacts</h2>
        <Card className="overflow-hidden py-0">
          {data.contacts.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No contacts recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell>{contact.role}</TableCell>
                    <TableCell>{contact.email}</TableCell>
                    <TableCell>{contact.phone ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
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
                  <TableHead>Developer</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">{assignment.projectName}</TableCell>
                    <TableCell>{assignment.developer.name}</TableCell>
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
                  <TableHead>Developer</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">{contract.developer.name}</TableCell>
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

      <ClientFormDialog open={editOpen} onOpenChange={setEditOpen} client={data} />
    </ManagementPage>
  );
}
