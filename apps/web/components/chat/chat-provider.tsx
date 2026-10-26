'use client';

import type {
  ChatMessage,
  ChatResponse,
  ConversationDetail,
  ConversationSummary,
} from '@/lib/types';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const CONVERSATION_STORAGE_KEY = 'aya:conversation-id';

interface ChatContextValue {
  messages: ChatMessage[];
  loading: boolean;
  historyLoading: boolean;
  error: string | null;
  conversationId: string | null;
  conversations: ConversationSummary[];
  conversationsLoading: boolean;
  sendMessage: (text: string) => Promise<void>;
  newChat: () => void;
  loadConversation: (id: string, options?: { silent?: boolean }) => Promise<void>;
  refreshConversations: () => Promise<void>;
  clearError: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(data.message)) return data.message.join(' ');
    if (typeof data.message === 'string' && data.message.trim()) return data.message;
  } catch {
    // Fall through to the generic message.
  }

  return `Request failed (${response.status}).`;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const conversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const clearError = useCallback(() => setError(null), []);

  const refreshConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/aya/conversations', { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as ConversationSummary[];
      setConversations(Array.isArray(data) ? data : []);
    } catch {
      // The sidebar history is non-critical. Chat errors are surfaced separately.
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  const loadConversation = useCallback(async (id: string, options?: { silent?: boolean }) => {
    abortRef.current?.abort();
    abortRef.current = null;
    sendingRef.current = false;
    loadAbortRef.current?.abort();

    const controller = new AbortController();
    loadAbortRef.current = controller;

    // Loading history is not the assistant "thinking", so keep the typing
    // indicator tied to sendMessage only.
    setLoading(false);
    setHistoryLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/aya/conversations/${encodeURIComponent(id)}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = (await response.json()) as ConversationDetail;
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setConversationId(data.id);
      conversationIdRef.current = data.id;
      window.localStorage.setItem(CONVERSATION_STORAGE_KEY, data.id);
    } catch (loadError) {
      if (isAbortError(loadError)) return;

      if (!options?.silent) {
        setError(
          loadError instanceof Error ? loadError.message : 'Could not load that conversation.',
        );
      }
      setMessages([]);
      setConversationId(null);
      conversationIdRef.current = null;
      window.localStorage.removeItem(CONVERSATION_STORAGE_KEY);
    } finally {
      if (loadAbortRef.current === controller) {
        loadAbortRef.current = null;
        setHistoryLoading(false);
      } else if (loadAbortRef.current === null) {
        // The load was superseded by a send or a new chat.
        setHistoryLoading(false);
      }
    }
  }, []);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    sendingRef.current = false;
    loadAbortRef.current?.abort();
    loadAbortRef.current = null;
    setMessages([]);
    setConversationId(null);
    conversationIdRef.current = null;
    setError(null);
    setLoading(false);
    setHistoryLoading(false);
    window.localStorage.removeItem(CONVERSATION_STORAGE_KEY);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sendingRef.current) return;

      // A stored conversation may still be loading when the user sends the
      // first message. Abort that load so it cannot overwrite this turn.
      loadAbortRef.current?.abort();
      loadAbortRef.current = null;
      setHistoryLoading(false);

      sendingRef.current = true;
      setError(null);
      setMessages((previous) => [...previous, { role: 'user', content: trimmed }]);
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch('/api/aya/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            conversationId: conversationIdRef.current,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(await getErrorMessage(response));
        }

        const data = (await response.json()) as Partial<ChatResponse>;
        if (typeof data.content !== 'string' || typeof data.conversationId !== 'string') {
          throw new Error('Aya returned an invalid response.');
        }

        setConversationId(data.conversationId);
        conversationIdRef.current = data.conversationId;
        window.localStorage.setItem(CONVERSATION_STORAGE_KEY, data.conversationId);
        setMessages((previous) => [
          ...previous,
          { role: 'assistant', content: data.content as string },
        ]);
        void refreshConversations();
      } catch (sendError) {
        if (isAbortError(sendError)) {
          return;
        }
        setError(
          sendError instanceof Error
            ? sendError.message
            : 'Could not reach Aya. Check that the API is running.',
        );
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          sendingRef.current = false;
          setLoading(false);
        }
      }
    },
    [refreshConversations],
  );

  useEffect(() => {
    void refreshConversations();

    const storedId = window.localStorage.getItem(CONVERSATION_STORAGE_KEY);
    if (storedId) {
      void loadConversation(storedId, { silent: true });
    }
  }, [loadConversation, refreshConversations]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      loadAbortRef.current?.abort();
    };
  }, []);

  const value = useMemo<ChatContextValue>(
    () => ({
      messages,
      loading,
      historyLoading,
      error,
      conversationId,
      conversations,
      conversationsLoading,
      sendMessage,
      newChat,
      loadConversation,
      refreshConversations,
      clearError,
    }),
    [
      messages,
      loading,
      historyLoading,
      error,
      conversationId,
      conversations,
      conversationsLoading,
      sendMessage,
      newChat,
      loadConversation,
      refreshConversations,
      clearError,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider.');
  }
  return context;
}
