'use client';

import { apiRequest } from '@/lib/api';
import type { ClientDetail, ContactRecord } from '@/lib/types';
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
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Field, FormError } from './ui';

type ContactRow = {
  key: string;
  name: string;
  role: string;
  email: string;
  phone: string;
};

function contactRows(contacts: ContactRecord[]): ContactRow[] {
  return contacts.map((contact) => ({
    key: contact.id,
    name: contact.name,
    role: contact.role,
    email: contact.email,
    phone: contact.phone ?? '',
  }));
}

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: ClientDetail | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{client ? 'Edit client' : 'Add client'}</DialogTitle>
          <DialogDescription>
            {client
              ? 'Update the account and its point-of-contact list.'
              : 'Create a client account with its primary contacts.'}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <ClientForm client={client ?? undefined} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ClientForm({ client, onDone }: { client?: ClientDetail; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(client?.name ?? '');
  const [industry, setIndustry] = useState(client?.industry ?? '');
  const [logoUrl, setLogoUrl] = useState(client?.logoUrl ?? '');
  const [contacts, setContacts] = useState<ContactRow[]>(contactRows(client?.contacts ?? []));
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      client
        ? apiRequest(`/clients/${client.id}`, { method: 'PATCH', body: payload })
        : apiRequest('/clients', { method: 'POST', body: payload }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['clients'] }),
        queryClient.invalidateQueries({ queryKey: ['client', client?.id] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      onDone();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const updateContact = (key: string, patch: Partial<ContactRow>) => {
    setContacts((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    mutation.mutate({
      name: name.trim(),
      industry: industry.trim(),
      logoUrl: logoUrl.trim() || null,
      contacts: contacts
        .filter((row) => row.name.trim() && row.email.trim())
        .map((row) => ({
          name: row.name.trim(),
          role: row.role.trim() || 'Contact',
          email: row.email.trim(),
          phone: row.phone.trim() || null,
        })),
    });
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <FormError message={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor="client-name">
          <Input
            id="client-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
          />
        </Field>
        <Field label="Industry" htmlFor="client-industry">
          <Input
            id="client-industry"
            value={industry}
            onChange={(event) => setIndustry(event.target.value)}
            required
            placeholder="fintech"
          />
        </Field>
      </div>
      <Field label="Logo URL" htmlFor="client-logo" hint="Optional image URL.">
        <Input
          id="client-logo"
          type="url"
          value={logoUrl ?? ''}
          onChange={(event) => setLogoUrl(event.target.value)}
        />
      </Field>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Contacts</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setContacts((rows) => [
                ...rows,
                { key: crypto.randomUUID(), name: '', role: '', email: '', phone: '' },
              ])
            }
          >
            <Plus />
            Add contact
          </Button>
        </div>
        {contacts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No contacts yet.</p>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact) => (
              <div key={contact.key} className="space-y-2 rounded-lg border p-2.5">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Name">
                    <Input
                      value={contact.name}
                      onChange={(event) => updateContact(contact.key, { name: event.target.value })}
                      placeholder="Jane Cruz"
                    />
                  </Field>
                  <Field label="Role">
                    <Input
                      value={contact.role}
                      onChange={(event) => updateContact(contact.key, { role: event.target.value })}
                      placeholder="CTO"
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      type="email"
                      value={contact.email}
                      onChange={(event) =>
                        updateContact(contact.key, { email: event.target.value })
                      }
                      placeholder="jane@example.com"
                    />
                  </Field>
                  <Field label="Phone">
                    <Input
                      value={contact.phone}
                      onChange={(event) =>
                        updateContact(contact.key, { phone: event.target.value })
                      }
                      placeholder="+63 900 000 0000"
                    />
                  </Field>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setContacts((rows) => rows.filter((row) => row.key !== contact.key))
                    }
                  >
                    <Trash2 />
                    Remove contact
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : client ? 'Save changes' : 'Create client'}
        </Button>
      </DialogFooter>
    </form>
  );
}
