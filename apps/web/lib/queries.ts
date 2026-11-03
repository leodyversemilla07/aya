import { getApiUrl } from './api';
import type { ConversationDetail, ConversationSummary, DashboardStats } from './types';

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(getApiUrl(path), {
    cache: 'no-store',
    credentials: 'include',
    signal,
  });
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const data = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(data.message)) message = data.message.join(' ');
      else if (typeof data.message === 'string' && data.message.trim()) message = data.message;
    } catch {
      // Use the status-based message when the response is not JSON.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export const queryKeys = {
  conversations: ['conversations'] as const,
  conversation: (id: string) => ['conversation', id] as const,
  stats: ['dashboard', 'stats'] as const,
};

export function conversationsQuery() {
  return {
    queryKey: queryKeys.conversations,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      getJson<ConversationSummary[]>('/conversations', signal),
  };
}

export function conversationQuery(id: string) {
  return {
    queryKey: queryKeys.conversation(id),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      getJson<ConversationDetail>(`/conversations/${encodeURIComponent(id)}`, signal),
  };
}

export function statsQuery() {
  return {
    queryKey: queryKeys.stats,
    queryFn: ({ signal }: { signal: AbortSignal }) => getJson<DashboardStats>('/stats', signal),
  };
}
