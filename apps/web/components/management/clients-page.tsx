'use client';

import { apiRequest } from '@/lib/api';
import { clientsQuery } from '@/lib/queries';
import type { ClientDetail, ClientSummary } from '@/lib/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import { Card } from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { Pencil, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { ClientFormDialog } from './client-form';
import { ConfirmDelete, EmptyRows, LoadingRows, ManagementPage, QueryError } from './ui';

export function ClientsPage() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClientDetail | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery(
    clientsQuery({ search: deferredSearch.trim() || undefined, limit: 100 }),
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/clients/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (mutationError: Error) => setActionError(mutationError.message),
  });

  const openEdit = async (client: ClientSummary) => {
    setActionError(null);
    try {
      const detail = await apiRequest<ClientDetail>(`/clients/${client.id}`);
      setEditing(detail);
      setDialogOpen(true);
    } catch (loadError) {
      setActionError(loadError instanceof Error ? loadError.message : 'Could not load client.');
    }
  };

  return (
    <ManagementPage
      title="Clients"
      subtitle="Account management"
      description="Manage client accounts, industries, and points of contact."
      action={
        <Button
          type="button"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus />
          Add client
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search name or industry"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search clients"
          />
        </div>
      </div>

      {actionError ? <QueryError message={actionError} /> : null}

      <Card className="overflow-hidden py-0">
        {isPending ? (
          <LoadingRows label="Loading clients…" />
        ) : error ? (
          <QueryError message={error.message} />
        ) : !data || data.items.length === 0 ? (
          <EmptyRows message="No clients match this search." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Active developers</TableHead>
                  <TableHead>Contacts</TableHead>
                  <TableHead>Contracts</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <Link href={`/clients/${client.id}`} className="font-medium hover:underline">
                        {client.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {client.industry}
                      </Badge>
                    </TableCell>
                    <TableCell>{client.activeDeveloperCount}</TableCell>
                    <TableCell>{client.contactCount}</TableCell>
                    <TableCell>{client.contractCount}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${client.name}`}
                          onClick={() => void openEdit(client)}
                        >
                          <Pencil />
                        </Button>
                        <ConfirmDelete
                          title="Delete client?"
                          description={`${client.name} and all related contacts, assignments, and contracts will be permanently deleted.`}
                          pending={
                            deleteMutation.isPending && deleteMutation.variables === client.id
                          }
                          onConfirm={() => deleteMutation.mutate(client.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t px-3 py-2 text-xs text-muted-foreground">
              Showing {data.items.length} of {data.total} clients
            </div>
          </>
        )}
      </Card>

      <ClientFormDialog open={dialogOpen} onOpenChange={setDialogOpen} client={editing} />
    </ManagementPage>
  );
}
