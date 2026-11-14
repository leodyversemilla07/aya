'use client';

import { apiRequest } from '@/lib/api';
import { findDuplicateSkillNames } from '@/lib/skills';
import type { DeveloperSummary, SkillRecord } from '@/lib/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Field, FormError, toDateInput } from './ui';

const SENIORITIES = ['junior', 'mid', 'senior', 'lead'] as const;
const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const;

type EditableDeveloper = Pick<
  DeveloperSummary,
  'id' | 'name' | 'email' | 'role' | 'seniority' | 'avatarUrl' | 'benchSince' | 'skills' | 'onBench'
>;

type SkillRow = { key: string; name: string; level: string; yearsExp: string };

function skillRows(skills: SkillRecord[]): SkillRow[] {
  return skills.map((skill) => ({
    key: skill.id,
    name: skill.name,
    level: skill.level,
    yearsExp: String(skill.yearsExp),
  }));
}

export function DeveloperFormDialog({
  open,
  onOpenChange,
  developer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  developer?: EditableDeveloper | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{developer ? 'Edit developer' : 'Add developer'}</DialogTitle>
          <DialogDescription>
            {developer
              ? 'Update profile details and the skill matrix.'
              : 'Create a developer profile with skills for matching.'}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <DeveloperForm developer={developer ?? undefined} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DeveloperForm({
  developer,
  onDone,
}: {
  developer?: EditableDeveloper;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(developer?.name ?? '');
  const [email, setEmail] = useState(developer?.email ?? '');
  const [role, setRole] = useState(developer?.role ?? '');
  const [seniority, setSeniority] = useState(developer?.seniority ?? 'mid');
  const [avatarUrl, setAvatarUrl] = useState(developer?.avatarUrl ?? '');
  const [benchSince, setBenchSince] = useState(toDateInput(developer?.benchSince));
  const [skills, setSkills] = useState<SkillRow[]>(skillRows(developer?.skills ?? []));
  const [error, setError] = useState<string | null>(null);

  // A developer holding an assignment is not on the bench, so the bench start
  // date only applies while they are unassigned.
  const assigned = developer ? !developer.onBench : false;

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      developer
        ? apiRequest(`/developers/${developer.id}`, { method: 'PATCH', body: payload })
        : apiRequest('/developers', { method: 'POST', body: payload }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['developers'] }),
        queryClient.invalidateQueries({ queryKey: ['developer', developer?.id] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      onDone();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const updateSkill = (key: string, patch: Partial<SkillRow>) => {
    setSkills((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const namedSkills = skills.filter((row) => row.name.trim());
  const duplicateSkills = findDuplicateSkillNames(namedSkills.map((row) => row.name));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (duplicateSkills.length > 0) {
      setError(`Duplicate skill "${duplicateSkills[0]}".`);
      return;
    }

    const payload = {
      name: name.trim(),
      email: email.trim(),
      role: role.trim(),
      seniority,
      avatarUrl: avatarUrl.trim() || null,
      benchSince: assigned ? null : benchSince || null,
      skills: namedSkills.map((row) => ({
        name: row.name.trim(),
        level: row.level,
        yearsExp: Number(row.yearsExp) || 0,
      })),
    };
    mutation.mutate(payload);
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <FormError message={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor="developer-name">
          <Input
            id="developer-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
          />
        </Field>
        <Field label="Email" htmlFor="developer-email">
          <Input
            id="developer-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <Field label="Role" htmlFor="developer-role">
          <Input
            id="developer-role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            required
            placeholder="Frontend Engineer"
          />
        </Field>
        <Field label="Seniority" htmlFor="developer-seniority">
          <Select value={seniority} onValueChange={setSeniority}>
            <SelectTrigger id="developer-seniority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SENIORITIES.map((level) => (
                <SelectItem key={level} value={level} className="capitalize">
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Avatar URL" htmlFor="developer-avatar" hint="Optional image URL.">
          <Input
            id="developer-avatar"
            type="url"
            value={avatarUrl ?? ''}
            onChange={(event) => setAvatarUrl(event.target.value)}
          />
        </Field>
        <Field
          label="Bench since"
          htmlFor="developer-bench"
          hint={
            assigned
              ? 'Unavailable while the developer holds an assignment.'
              : 'When their current bench period started.'
          }
        >
          <Input
            id="developer-bench"
            type="date"
            value={assigned ? '' : benchSince}
            disabled={assigned}
            onChange={(event) => setBenchSince(event.target.value)}
          />
        </Field>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Skills</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setSkills((rows) => [
                ...rows,
                {
                  key: crypto.randomUUID(),
                  name: '',
                  level: 'intermediate',
                  yearsExp: '1',
                },
              ])
            }
          >
            <Plus />
            Add skill
          </Button>
        </div>
        {skills.length === 0 ? (
          <p className="text-xs text-muted-foreground">No skills yet. Add at least one.</p>
        ) : (
          <div className="space-y-2">
            {duplicateSkills.length > 0 ? (
              <p className="text-xs text-destructive">
                Duplicate skill &quot;{duplicateSkills[0]}&quot;. Each skill can only be listed
                once.
              </p>
            ) : null}
            {skills.map((skill) => (
              <div key={skill.key} className="flex items-end gap-2">
                <Field label="Skill" className="flex-1">
                  <Input
                    value={skill.name}
                    onChange={(event) => updateSkill(skill.key, { name: event.target.value })}
                    placeholder="React"
                  />
                </Field>
                <Field label="Level">
                  <Select
                    value={skill.level}
                    onValueChange={(value) => updateSkill(skill.key, { level: value })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((level) => (
                        <SelectItem key={level} value={level} className="capitalize">
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Years">
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    className="w-20"
                    value={skill.yearsExp}
                    onChange={(event) => updateSkill(skill.key, { yearsExp: event.target.value })}
                  />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove skill"
                  onClick={() => setSkills((rows) => rows.filter((row) => row.key !== skill.key))}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending || duplicateSkills.length > 0}>
          {mutation.isPending ? 'Saving…' : developer ? 'Save changes' : 'Create developer'}
        </Button>
      </DialogFooter>
    </form>
  );
}
