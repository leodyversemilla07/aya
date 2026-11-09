'use client';

import { apiRequest } from '@/lib/api';
import { developersQuery } from '@/lib/queries';
import type { PerformanceRecord } from '@/lib/types';
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
import { Textarea } from '@workspace/ui/components/textarea';
import { useState } from 'react';
import { Field, FormError } from './ui';

export function PerformanceFormDialog({
  open,
  onOpenChange,
  performance,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  performance?: PerformanceRecord | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{performance ? 'Edit performance' : 'Add performance'}</DialogTitle>
          <DialogDescription>
            One record per developer and period. Periods use `YYYY-Q1` or `YYYY-MM`.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <PerformanceForm
            performance={performance ?? undefined}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PerformanceForm({
  performance,
  onDone,
}: {
  performance?: PerformanceRecord;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const developers = useQuery(developersQuery({ limit: 200 }));

  const [developerId, setDeveloperId] = useState(performance?.developerId ?? '');
  const [period, setPeriod] = useState(performance?.period ?? '');
  const [velocity, setVelocity] = useState(performance ? String(performance.velocity) : '40');
  const [prMergeTime, setPrMergeTime] = useState(
    performance ? String(performance.prMergeTime) : '2',
  );
  const [codeQuality, setCodeQuality] = useState(
    performance ? String(performance.codeQuality) : '85',
  );
  const [clientRating, setClientRating] = useState(
    performance?.clientRating != null ? String(performance.clientRating) : '',
  );
  const [notes, setNotes] = useState(performance?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      performance
        ? apiRequest(`/performance/${performance.id}`, { method: 'PATCH', body: payload })
        : apiRequest('/performance', { method: 'POST', body: payload }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['performance'] }),
        queryClient.invalidateQueries({ queryKey: ['developers'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      onDone();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!developerId) {
      setError('Select a developer.');
      return;
    }
    mutation.mutate({
      developerId,
      period: period.trim(),
      velocity: Number(velocity) || 0,
      prMergeTime: Number(prMergeTime) || 0,
      codeQuality: Number(codeQuality) || 0,
      clientRating: clientRating ? Number(clientRating) : null,
      notes: notes.trim() || null,
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
        <Field label="Period" htmlFor="performance-period" hint="Example: 2026-Q3">
          <Input
            id="performance-period"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            required
            placeholder="2026-Q3"
          />
        </Field>
        <Field label="Velocity" htmlFor="performance-velocity" hint="Story points per sprint.">
          <Input
            id="performance-velocity"
            type="number"
            min={0}
            step="0.1"
            value={velocity}
            onChange={(event) => setVelocity(event.target.value)}
            required
          />
        </Field>
        <Field label="PR merge time" htmlFor="performance-merge" hint="Average days.">
          <Input
            id="performance-merge"
            type="number"
            min={0}
            step="0.1"
            value={prMergeTime}
            onChange={(event) => setPrMergeTime(event.target.value)}
            required
          />
        </Field>
        <Field label="Code quality" htmlFor="performance-quality" hint="0–100.">
          <Input
            id="performance-quality"
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={codeQuality}
            onChange={(event) => setCodeQuality(event.target.value)}
            required
          />
        </Field>
        <Field label="Client rating" htmlFor="performance-rating" hint="Optional, 1–5.">
          <Input
            id="performance-rating"
            type="number"
            min={1}
            max={5}
            step="0.1"
            value={clientRating}
            onChange={(event) => setClientRating(event.target.value)}
          />
        </Field>
      </div>
      <Field label="Notes" htmlFor="performance-notes" hint="Optional context for the record.">
        <Textarea
          id="performance-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={2000}
          rows={3}
        />
      </Field>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : performance ? 'Save changes' : 'Create record'}
        </Button>
      </DialogFooter>
    </form>
  );
}
