'use client';

import { apiRequest } from '@/lib/api';
import { notificationsQuery, queryKeys } from '@/lib/queries';
import type { NotificationRecord } from '@/lib/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import { Card } from '@workspace/ui/components/card';
import { Check, CheckCheck, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { EmptyRows, LoadingRows, ManagementPage, QueryError } from './management/ui';

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function severityVariant(severity: string): 'destructive' | 'secondary' | 'outline' {
  if (severity === 'high') return 'destructive';
  if (severity === 'medium') return 'secondary';
  return 'outline';
}

function NotificationCard({
  notification,
  onRead,
  pending,
}: {
  notification: NotificationRecord;
  onRead: () => void;
  pending: boolean;
}) {
  return (
    <Card
      className={`gap-3 py-4 ${notification.read ? '' : 'border-primary/30 bg-primary/[0.03]'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{notification.title}</p>
            <Badge variant={severityVariant(notification.severity)}>{notification.severity}</Badge>
            {!notification.read ? <Badge>New</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">{notification.message}</p>
          <p className="text-xs text-muted-foreground">
            {formatTimestamp(notification.createdAt)} · {notification.alert.type} ·{' '}
            <span className="font-mono">{notification.alert.fingerprint}</span>
          </p>
        </div>
        <Button
          type="button"
          data-testid="notification-read-button"
          size="sm"
          variant={notification.read ? 'ghost' : 'outline'}
          disabled={notification.read || pending}
          onClick={onRead}
        >
          {pending ? <Loader2 className="animate-spin" /> : <Check />}
          {notification.read ? 'Read' : 'Mark read'}
        </Button>
      </div>
    </Card>
  );
}

export function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const queryClient = useQueryClient();
  const notifications = useQuery(notificationsQuery(unreadOnly));
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
  };
  const markRead = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }),
    onSuccess: refresh,
  });
  const markAllRead = useMutation({
    mutationFn: () => apiRequest('/notifications/read-all', { method: 'POST' }),
    onSuccess: refresh,
  });

  return (
    <ManagementPage
      title="Notifications"
      subtitle="Workspace inbox"
      description="Review staffing alerts detected by the background worker."
      action={
        <div className="flex gap-2">
          <Button
            type="button"
            variant={unreadOnly ? 'secondary' : 'outline'}
            onClick={() => setUnreadOnly((value) => !value)}
          >
            {unreadOnly ? 'Show all' : 'Unread only'}
          </Button>
          <Button
            type="button"
            disabled={!notifications.data?.unreadTotal || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            {markAllRead.isPending ? <Loader2 className="animate-spin" /> : <CheckCheck />}
            Mark all read
          </Button>
        </div>
      }
    >
      {notifications.isPending ? (
        <LoadingRows label="Loading notifications…" />
      ) : notifications.error ? (
        <QueryError message={notifications.error.message} />
      ) : !notifications.data || notifications.data.items.length === 0 ? (
        <Card>
          <EmptyRows
            message={
              unreadOnly
                ? 'No unread notifications.'
                : 'No staffing notifications have been generated yet.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.data.items.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              pending={markRead.isPending && markRead.variables === notification.id}
              onRead={() => markRead.mutate(notification.id)}
            />
          ))}
          <p className="text-xs text-muted-foreground">
            Showing {notifications.data.items.length} of {notifications.data.total} notifications ·{' '}
            {notifications.data.unreadTotal} unread
          </p>
        </div>
      )}
    </ManagementPage>
  );
}
