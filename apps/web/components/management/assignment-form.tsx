'use client';

import { apiRequest } from '@/lib/api';
import { clientsQuery, developersQuery } from '@/lib/queries';
import type { AssignmentRecord } from '@/lib/types';
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

const STATUSES = ['active', 'ending', 'transition', 'completed'] as const;

export function AssignmentFormDialog({
  open,
  onOpenChange,
  assignment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment?: AssignmentRecord | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{assignment ? 'Edit assignment' : 'Add assignment'}</DialogTitle>
          <DialogDescription>
            Assignments place a developer on a project at a client.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <AssignmentForm assignment={assignment ?? undefined} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AssignmentForm({
  assignment,
  onDone,
}: {
  assignment?: AssignmentRecord;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const developers = useQuery(developersQuery({ limit: 200 }));
  const clients = useQuery(clientsQuery({ limit: 200 }));

  const [developerId, setDeveloperId] = useState(assignment?.developerId ?? '');
  const [clientId, setClientId] = useState(assignment?.clientId ?? '');
  const [projectName, setProjectName] = useState(assignment?.projectName ?? '');
  const [status, setStatus] = useState(assignment?.status ?? 'active');
  const [startDate, setStartDate] = useState(
    toDateInput(assignment?.startDate) || new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState(toDateInput(assignment?.endDate));
  const [jiraBoardUrl, setJiraBoardUrl] = useState(assignment?.jiraBoardUrl ?? '');
  const [githubRepoUrl, setGithubRepoUrl] = useState(assignment?.githubRepoUrl ?? '');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      assignment
        ? apiRequest(`/assignments/${assignment.id}`, { method: 'PATCH', body: payload })
        : apiRequest('/assignments', { method: 'POST', body: payload }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['assignments'] }),
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
      projectName: projectName.trim(),
      status,
      startDate,
      endDate: endDate || null,
      jiraBoardUrl: jiraBoardUrl.trim() || null,
      githubRepoUrl: githubRepoUrl.trim() || null,
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
        <Field label="Project name" htmlFor="assignment-project" className="sm:col-span-2">
          <Input
            id="assignment-project"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            required
            placeholder="Payments platform"
          />
        </Field>
        <Field label="Start date" htmlFor="assignment-start">
          <Input
            id="assignment-start"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            required
          />
        </Field>
        <Field label="End date" htmlFor="assignment-end" hint="Leave empty for open-ended.">
          <Input
            id="assignment-end"
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
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
        <Field label="Jira board URL" htmlFor="assignment-jira" hint="Optional.">
          <Input
            id="assignment-jira"
            type="url"
            value={jiraBoardUrl}
            onChange={(event) => setJiraBoardUrl(event.target.value)}
          />
        </Field>
        <Field label="GitHub repo URL" htmlFor="assignment-github" hint="Optional.">
          <Input
            id="assignment-github"
            type="url"
            value={githubRepoUrl}
            onChange={(event) => setGithubRepoUrl(event.target.value)}
          />
        </Field>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : assignment ? 'Save changes' : 'Create assignment'}
        </Button>
      </DialogFooter>
    </form>
  );
}
