'use client';

import { apiRequest } from '@/lib/api';
import { developersQuery } from '@/lib/queries';
import type { DeveloperSummary } from '@/lib/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import { Card } from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
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
import { Pencil, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { DeveloperFormDialog } from './developer-form';
import { ConfirmDelete, EmptyRows, LoadingRows, ManagementPage, QueryError } from './ui';

const SENIORITIES = ['junior', 'mid', 'senior', 'lead'] as const;

export function DevelopersPage() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [seniority, setSeniority] = useState('all');
  const [bench, setBench] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DeveloperSummary | null>(null);

  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery(
    developersQuery({
      search: deferredSearch.trim() || undefined,
      seniority: seniority === 'all' ? undefined : seniority,
      onBench: bench === 'all' ? undefined : bench === 'true',
      limit: 100,
    }),
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/developers/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['developers'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return (
    <ManagementPage
      title="Developers"
      subtitle="Roster management"
      description="Search the roster, keep skill data current, and adjust availability."
      action={
        <Button
          type="button"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus />
          Add developer
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search name, email, or role"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search developers"
          />
        </div>
        <Select value={seniority} onValueChange={setSeniority}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All seniority</SelectItem>
            {SENIORITIES.map((value) => (
              <SelectItem key={value} value={value} className="capitalize">
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={bench} onValueChange={setBench}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All availability</SelectItem>
            <SelectItem value="true">On bench</SelectItem>
            <SelectItem value="false">Assigned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden py-0">
        {isPending ? (
          <LoadingRows label="Loading developers…" />
        ) : error ? (
          <QueryError message={error.message} />
        ) : !data || data.items.length === 0 ? (
          <EmptyRows message="No developers match these filters." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Developer</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Seniority</TableHead>
                  <TableHead>Current assignment</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((developer) => (
                  <TableRow key={developer.id}>
                    <TableCell>
                      <Link
                        href={`/developers/${developer.id}`}
                        className="font-medium hover:underline"
                      >
                        {developer.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{developer.email}</p>
                    </TableCell>
                    <TableCell>{developer.role}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {developer.seniority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {developer.currentAssignment ? (
                        <div>
                          <p>{developer.currentAssignment.clientName}</p>
                          <p className="text-xs text-muted-foreground">
                            {developer.currentAssignment.projectName}
                          </p>
                        </div>
                      ) : (
                        <Badge variant="secondary">Bench</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-64 flex-wrap gap-1">
                        {developer.skills.slice(0, 3).map((skill) => (
                          <Badge key={skill.id} variant="outline">
                            {skill.name}
                          </Badge>
                        ))}
                        {developer.skills.length > 3 ? (
                          <Badge variant="ghost">+{developer.skills.length - 3}</Badge>
                        ) : null}
                        {developer.skills.length === 0 ? (
                          <span className="text-xs text-muted-foreground">No skills</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${developer.name}`}
                          onClick={() => {
                            setEditing(developer);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil />
                        </Button>
                        <ConfirmDelete
                          title="Delete developer?"
                          description={`${developer.name} and their skills, assignments, contracts, and performance records will be permanently deleted.`}
                          pending={
                            deleteMutation.isPending && deleteMutation.variables === developer.id
                          }
                          onConfirm={() => deleteMutation.mutate(developer.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t px-3 py-2 text-xs text-muted-foreground">
              Showing {data.items.length} of {data.total} developers
            </div>
          </>
        )}
      </Card>

      <DeveloperFormDialog open={dialogOpen} onOpenChange={setDialogOpen} developer={editing} />
    </ManagementPage>
  );
}
