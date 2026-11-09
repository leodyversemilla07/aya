'use client';

import { apiRequest } from '@/lib/api';
import { clientsQuery, developersQuery } from '@/lib/queries';
import type { ContractRecord } from '@/lib/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@workspace/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';
import { Input } from '@workspace/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { useState } from 'react';
import { Field, FormError, toDateInput } from './ui';

const STATUSES = ['active', 'renewing', 'expired'] as const;

export function ContractFormDialog({
  open,
  onOpenChange,
  contract,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract?: ContractRecord | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{contract ? 'Edit contract' : 'Add contract'}</DialogTitle>
          <DialogDescription>
            Contracts link a developer to a client with dates, rate, and status.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <ContractForm contract={contract ?? undefined} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ContractForm({ contract, onDone }: { contract?: ContractRecord; onDone: () => void }) {
  const queryClient = useQueryClient();
  const developers = useQuery(developersQuery({ limit: 200 }));
  const clients = useQuery(clientsQuery({ limit: 200 }));

  const [developerId, setDeveloperId] = useState(contract?.developerId ?? '');
  const [clientId, setClientId] = useState(contract?.clientId ?? '');
  const [startDate, setStartDate] = useState(
    toDateInput(contract?.startDate) || new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState(toDateInput(contract?.endDate));
  const [billingRate, setBillingRate] = useState(contract ? String(contract.billingRate) : '5000');
  const [status, setStatus] = useState(contract?.status ?? 'active');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      contract
        ? apiRequest(`/contracts/${contract.id}`, { method: 'PATCH', body: payload })
        : apiRequest('/contracts', { method: 'POST', body: payload }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contracts'] }),
        queryClient.invalidateQueries({ queryKey: ['developers'] }),
        queryClient.invalidateQueries({ queryKey: ['clients'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      onDone();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!developerId || !clientId) {
      setError('Select both a developer and a client.');
      return;
    }
    mutation.mutate({
      developerId,
      clientId,
      startDate,
      endDate,
      billingRate: Number(billingRate) || 0,
      status,
    });
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <FormError message={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Developer">
          <Select value={developerId} onValueChange={setDeveloperId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select developer" />
            </SelectTrigger>
            <SelectContent>
              {developers.data?.items.map((developer) => (
                <SelectItem key={developer.id} value={developer.id}>
                  {developer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Client">
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent>
              {clients.data?.items.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Start date" htmlFor="contract-start">
          <Input
            id="contract-start"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            required
          />
        </Field>
        <Field label="End date" htmlFor="contract-end">
          <Input
            id="contract-end"
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            required
          />
        </Field>
        <Field label="Billing rate" htmlFor="contract-rate" hint="Monthly, in USD.">
          <Input
            id="contract-rate"
            type="number"
            min={0}
            step="0.01"
            value={billingRate}
            onChange={(event) => setBillingRate(event.target.value)}
            required
          />
        </Field>
        <Field label="Status">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((value) => (
                <SelectItem key={value} value={value} className="capitalize">
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : contract ? 'Save changes' : 'Create contract'}
        </Button>
      </DialogFooter>
    </form>
  );
}
