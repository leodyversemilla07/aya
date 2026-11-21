import type { UserRole } from '@workspace/auth/roles';

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

// ─── Capacity forecast ─────────────────────────────────

export interface ForecastRecommendation {
  developerId: string;
  name: string;
  seniority: string;
  score: number;
  confidence: 'strong' | 'partial' | 'weak';
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
  availableFrom: string | null;
}

export interface ForecastOpening {
  contractId: string;
  developerId: string;
  developer: string;
  developerSeniority: string;
  clientId: string;
  client: string;
  clientIndustry: string;
  endDate: string;
  daysUntilEnd: number;
  renewalLikely: boolean;
  requiredSkills: Array<{ name: string; level: string }>;
  recommendations: ForecastRecommendation[];
}

export interface ForecastWeek {
  weekStart: string;
  weekEnd: string;
  onBench: number;
  openings: number;
  utilizationRate: number;
}

export interface ForecastBenchMember {
  developerId: string;
  name: string;
  seniority: string;
  benchSince: string | null;
  benchDays: number;
  skills: string[];
}

export interface CapacityForecast {
  horizonWeeks: number;
  generatedAt: string;
  today: string;
  summary: {
    developers: number;
    onBenchNow: number;
    benchOver30Days: number;
    openings: number;
    clientsAffected: number;
    projectedBench: number;
    projectedUtilization: number;
    openingsWithRecommendations: number;
  };
  timeline: ForecastWeek[];
  openings: ForecastOpening[];
  benchPool: ForecastBenchMember[];
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
  onBench: boolean;
  currentAssignment: {
    id: string;
    projectName: string;
    clientId: string;
    clientName: string;
    endDate: string | null;
  } | null;
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

// ─── Administration ───────────────────────────────────

export interface WorkspaceUserRecord {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRecord {
  id: string;
  event: 'opened' | 'updated' | 'reopened' | 'resolved';
  severity: 'high' | 'medium' | 'low' | string;
  title: string;
  message: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
  alert: {
    fingerprint: string;
    type: string;
    status: string;
    entityType: string;
    entityId: string;
  };
}

export interface NotificationList extends Paginated<NotificationRecord> {
  unreadTotal: number;
}

export interface UnreadNotificationCount {
  unread: number;
}

export interface AuditLogRecord {
  id: string;
  actor: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  } | null;
  actorType: 'user' | 'api-key';
  actorName: string;
  actorKey: string | null;
  action: 'create' | 'update' | 'delete' | 'scan';
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  requestId: string | null;
  createdAt: string;
}
