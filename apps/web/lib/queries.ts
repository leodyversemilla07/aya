import { apiRequest, buildQuery } from './api';
import type {
  AssignmentRecord,
  ClientDetail,
  ClientSummary,
  ContractRecord,
  ConversationDetail,
  ConversationSummary,
  DashboardStats,
  DeveloperDetail,
  DeveloperSummary,
  Paginated,
  PerformanceRecord,
} from './types';

function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  return apiRequest<T>(path, { signal });
}

export interface DeveloperQuery {
  search?: string;
  seniority?: string;
  skill?: string;
  clientId?: string;
  onBench?: boolean;
  limit?: number;
  offset?: number;
}

export interface ClientQuery {
  search?: string;
  industry?: string;
  limit?: number;
  offset?: number;
}

export interface ContractQuery {
  status?: string;
  clientId?: string;
  developerId?: string;
  expiringWithin?: number;
  limit?: number;
  offset?: number;
}

export interface AssignmentQuery {
  status?: string;
  clientId?: string;
  developerId?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
}

export interface PerformanceQuery {
  developerId?: string;
  period?: string;
  limit?: number;
  offset?: number;
}

export const queryKeys = {
  conversations: ['conversations'] as const,
  conversation: (id: string) => ['conversation', id] as const,
  stats: ['dashboard', 'stats'] as const,
  developers: (query: DeveloperQuery) => ['developers', query] as const,
  developer: (id: string) => ['developer', id] as const,
  clients: (query: ClientQuery) => ['clients', query] as const,
  client: (id: string) => ['client', id] as const,
  contracts: (query: ContractQuery) => ['contracts', query] as const,
  assignments: (query: AssignmentQuery) => ['assignments', query] as const,
  performance: (query: PerformanceQuery) => ['performance', query] as const,
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

export function developersQuery(query: DeveloperQuery) {
  return {
    queryKey: queryKeys.developers(query),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      getJson<Paginated<DeveloperSummary>>(`/developers${buildQuery({ ...query })}`, signal),
  };
}

export function developerQuery(id: string) {
  return {
    queryKey: queryKeys.developer(id),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      getJson<DeveloperDetail>(`/developers/${encodeURIComponent(id)}`, signal),
  };
}

export function clientsQuery(query: ClientQuery) {
  return {
    queryKey: queryKeys.clients(query),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      getJson<Paginated<ClientSummary>>(`/clients${buildQuery({ ...query })}`, signal),
  };
}

export function clientQuery(id: string) {
  return {
    queryKey: queryKeys.client(id),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      getJson<ClientDetail>(`/clients/${encodeURIComponent(id)}`, signal),
  };
}

export function contractsQuery(query: ContractQuery) {
  return {
    queryKey: queryKeys.contracts(query),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      getJson<Paginated<ContractRecord>>(`/contracts${buildQuery({ ...query })}`, signal),
  };
}

export function assignmentsQuery(query: AssignmentQuery) {
  return {
    queryKey: queryKeys.assignments(query),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      getJson<Paginated<AssignmentRecord>>(`/assignments${buildQuery({ ...query })}`, signal),
  };
}

export function performanceQuery(query: PerformanceQuery) {
  return {
    queryKey: queryKeys.performance(query),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      getJson<Paginated<PerformanceRecord>>(`/performance${buildQuery({ ...query })}`, signal),
  };
}
