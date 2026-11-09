export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id?: string;
  role: ChatRole;
  content: string;
  createdAt?: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
  lastMessageAt: string;
  updatedAt: string;
}

export interface ConversationDetail {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  hasMore?: boolean;
  nextCursor?: string | null;
}

export interface DashboardStats {
  developers: number;
  onBench: number;
  assigned: number;
  clients: number;
  activeContracts: number;
  expiringContracts: number;
  openAlerts: number;
  benchOver14Days: number;
  conversations: number;
  utilizationRate: number;
  updatedAt: string;
}

export interface ChatResponse {
  conversationId: string;
  content: string;
}

// ─── Management ───────────────────────────────────────

export interface Paginated<T> {
  total: number;
  limit: number;
  offset: number;
  items: T[];
}

export interface SkillRecord {
  id: string;
  name: string;
  level: string;
  yearsExp: number;
}

export interface DeveloperSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  seniority: string;
  avatarUrl: string | null;
  benchSince: string | null;
  skills: SkillRecord[];
  currentAssignment: {
    id: string;
    projectName: string;
    clientId: string;
    clientName: string;
    endDate: string | null;
  } | null;
  onBench: boolean;
  contractCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContactRecord {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string | null;
}

export interface ClientSummary {
  id: string;
  name: string;
  industry: string;
  logoUrl: string | null;
  contactCount: number;
  contractCount: number;
  assignmentCount: number;
  activeDeveloperCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContractRecord {
  id: string;
  developerId: string;
  developer: { id: string; name: string; role?: string; seniority?: string };
  clientId: string;
  client: { id: string; name: string; industry?: string };
  startDate: string;
  endDate: string;
  billingRate: number;
  status: string;
  daysUntilExpiry: number;
  isExpired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentRecord {
  id: string;
  developerId: string;
  developer: { id: string; name: string; role?: string; seniority?: string };
  clientId: string;
  client: { id: string; name: string; industry?: string };
  projectName: string;
  status: string;
  startDate: string;
  endDate: string | null;
  jiraBoardUrl: string | null;
  githubRepoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceRecord {
  id: string;
  developerId: string;
  developer: { id: string; name: string; role?: string; seniority?: string };
  period: string;
  velocity: number;
  prMergeTime: number;
  codeQuality: number;
  clientRating: number | null;
  notes: string | null;
  createdAt: string;
}

export interface DeveloperDetail {
  id: string;
  name: string;
  email: string;
  role: string;
  seniority: string;
  avatarUrl: string | null;
  benchSince: string | null;
  skills: SkillRecord[];
  assignments: AssignmentRecord[];
  contracts: ContractRecord[];
  performance: Omit<PerformanceRecord, 'developer'>[];
  createdAt: string;
  updatedAt: string;
}

export interface ClientDetail {
  id: string;
  name: string;
  industry: string;
  logoUrl: string | null;
  contacts: ContactRecord[];
  assignments: AssignmentRecord[];
  contracts: ContractRecord[];
  createdAt: string;
  updatedAt: string;
}
