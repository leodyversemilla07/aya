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
