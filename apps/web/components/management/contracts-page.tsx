'use client';

import { apiRequest } from '@/lib/api';
import { contractsQuery } from '@/lib/queries';
import type { ContractRecord } from '@/lib/types';
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
import { ContractFormDialog } from './contract-form';
import {
  ConfirmDelete,
  EmptyRows,
  LoadingRows,
  ManagementPage,
  QueryError,
  StatusBadge,
  formatDate,
  formatMoney,
} from './ui';

export function ContractsPage() {
  const [status, setStatus] = useState('all');
  const [expiring, setExpiring] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContractRecord | null>(null);

  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery(
    contractsQuery({
      status: status === 'all' ? undefined : status,
      expiringWithin: expiring === 'all' ? undefined : Number(expiring),
      limit: 200,
    }),
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/contracts/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['contracts'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return (
    <ManagementPage
      title="Contracts"
      subtitle="Commercial management"
      description="Track billing rates, renewal windows, and contract status."
      action={
        <Button
          type="button"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus />
          Add contract
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
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="renewing">Renewing</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Select value={expiring} onValueChange={setExpiring}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any expiry</SelectItem>
            <SelectItem value="30">Expiring in 30 days</SelectItem>
            <SelectItem value="60">Expiring in 60 days</SelectItem>
            <SelectItem value="90">Expiring in 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden py-0">
        {isPending ? (
          <LoadingRows label="Loading contracts…" />
        ) : error ? (
          <QueryError message={error.message} />
        ) : !data || data.items.length === 0 ? (
          <EmptyRows message="No contracts match these filters." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Developer</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">{contract.developer.name}</TableCell>
                    <TableCell>{contract.client.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(contract.startDate)} → {formatDate(contract.endDate)}
                    </TableCell>
                    <TableCell>{formatMoney(contract.billingRate)}</TableCell>
                    <TableCell>
                      {contract.isExpired ? (
                        <span className="text-destructive">
                          Expired {Math.abs(contract.daysUntilExpiry)}d ago
                        </span>
                      ) : contract.daysUntilExpiry <= 30 ? (
                        <span className="text-amber-600 dark:text-amber-400">
                          {contract.daysUntilExpiry}d left
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {contract.daysUntilExpiry}d left
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={contract.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit contract for ${contract.developer.name}`}
                          onClick={() => {
                            setEditing(contract);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil />
                        </Button>
                        <ConfirmDelete
                          title="Delete contract?"
                          description={`The contract between ${contract.developer.name} and ${contract.client.name} will be permanently deleted.`}
                          pending={
                            deleteMutation.isPending && deleteMutation.variables === contract.id
                          }
                          onConfirm={() => deleteMutation.mutate(contract.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t px-3 py-2 text-xs text-muted-foreground">
              Showing {data.items.length} of {data.total} contracts
            </div>
          </>
        )}
      </Card>

      <ContractFormDialog open={dialogOpen} onOpenChange={setDialogOpen} contract={editing} />
    </ManagementPage>
  );
}
