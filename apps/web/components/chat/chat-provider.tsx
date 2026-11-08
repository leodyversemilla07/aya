'use client';

import { getApiUrl } from '@/lib/api';
import { consumeChatStream } from '@/lib/chat-stream';
import { conversationsQuery, queryKeys } from '@/lib/queries';
import type {
  ChatMessage,
  ChatResponse,
  ConversationDetail,
  ConversationSummary,
} from '@/lib/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
const PAGE_SIZE = 50;

interface ChatContextValue {
  messages: ChatMessage[];
  loading: boolean;
  historyLoading: boolean;
  loadingOlder: boolean;
  hasMore: boolean;
  status: string | null;
  streamingContent: string;
  error: string | null;
  conversationId: string | null;
  conversations: ConversationSummary[];
  conversationsLoading: boolean;
  sendMessage: (text: string) => Promise<void>;
  newChat: () => void;
  loadConversation: (id: string, options?: { silent?: boolean }) => Promise<void>;
  loadOlderMessages: () => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
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
  const queryClient = useQueryClient();
  const conversationsQueryState = useQuery(conversationsQuery());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);
  const olderAbortRef = useRef<AbortController | null>(null);
  const loadingOlderRef = useRef(false);
  const sendingRef = useRef(false);
  const conversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const clearError = useCallback(() => setError(null), []);

  const refreshConversations = useCallback(async () => {
    await conversationsQueryState.refetch();
  }, [conversationsQueryState.refetch]);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    sendingRef.current = false;
    loadAbortRef.current?.abort();
    loadAbortRef.current = null;
    olderAbortRef.current?.abort();
    olderAbortRef.current = null;
    loadingOlderRef.current = false;
    setMessages([]);
    setConversationId(null);
    conversationIdRef.current = null;
    setError(null);
    setLoading(false);
    setHistoryLoading(false);
    setLoadingOlder(false);
    setHasMore(false);
    setNextCursor(null);
    setStatus(null);
    setStreamingContent('');
    window.localStorage.removeItem(CONVERSATION_STORAGE_KEY);
  }, []);

  const loadConversation = useCallback(
    async (id: string, options?: { silent?: boolean }) => {
      abortRef.current?.abort();
      abortRef.current = null;
      sendingRef.current = false;
      loadAbortRef.current?.abort();
      olderAbortRef.current?.abort();
      olderAbortRef.current = null;
      loadingOlderRef.current = false;

      const controller = new AbortController();
      loadAbortRef.current = controller;

      // Loading history is not the assistant "thinking", so keep the typing
      // indicator tied to sendMessage only.
      setLoading(false);
      setHistoryLoading(true);
      setLoadingOlder(false);
      setStatus(null);
      setStreamingContent('');
      setError(null);

      try {
        const response = await fetch(
          getApiUrl(`/conversations/${encodeURIComponent(id)}?limit=${PAGE_SIZE}`),
          {
            cache: 'no-store',
            credentials: 'include',
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          throw new Error(await getErrorMessage(response));
        }

        const data = (await response.json()) as ConversationDetail;
        queryClient.setQueryData(queryKeys.conversation(data.id), data);
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        setHasMore(Boolean(data.hasMore));
        setNextCursor(data.nextCursor ?? null);
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
        setHasMore(false);
        setNextCursor(null);
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
    },
    [queryClient],
  );

  const loadOlderMessages = useCallback(async () => {
    const id = conversationIdRef.current;
    if (!id || !nextCursor || loadingOlderRef.current) return;

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    setError(null);

    const controller = new AbortController();
    olderAbortRef.current = controller;

    try {
      const response = await fetch(
        getApiUrl(
          `/conversations/${encodeURIComponent(id)}?limit=${PAGE_SIZE}&before=${encodeURIComponent(nextCursor)}`,
        ),
        {
          cache: 'no-store',
          credentials: 'include',
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = (await response.json()) as ConversationDetail;
      const older = Array.isArray(data.messages) ? data.messages : [];
      setMessages((previous) => {
        const existing = new Set(previous.map((message) => message.id).filter(Boolean));
        const fresh = older.filter((message) => !message.id || !existing.has(message.id));
        return [...fresh, ...previous];
      });
      setHasMore(Boolean(data.hasMore));
      setNextCursor(data.nextCursor ?? null);
    } catch (loadError) {
      if (isAbortError(loadError)) return;
      setError(loadError instanceof Error ? loadError.message : 'Could not load earlier messages.');
    } finally {
      if (olderAbortRef.current === controller) {
        olderAbortRef.current = null;
        loadingOlderRef.current = false;
        setLoadingOlder(false);
      }
    }
  }, [nextCursor]);

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(getApiUrl(`/conversations/${encodeURIComponent(id)}`), {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error(await getErrorMessage(response));
        }

        queryClient.removeQueries({ queryKey: queryKeys.conversation(id) });
        if (conversationIdRef.current === id) {
          newChat();
        }
        await queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
      } catch (deleteError) {
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : 'Could not delete that conversation.',
        );
      }
    },
    [newChat, queryClient],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sendingRef.current) return;

      // A stored conversation may still be loading when the user sends the
      // first message. Abort that load so it cannot overwrite this turn.
      loadAbortRef.current?.abort();
      loadAbortRef.current = null;
      olderAbortRef.current?.abort();
      olderAbortRef.current = null;
      loadingOlderRef.current = false;
      setHistoryLoading(false);
      setLoadingOlder(false);

      sendingRef.current = true;
      setError(null);
      setStatus(null);
      setStreamingContent('');
      setMessages((previous) => [...previous, { role: 'user', content: trimmed }]);
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(getApiUrl('/agent/chat/stream'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            message: trimmed,
            conversationId: conversationIdRef.current,
          }),
          credentials: 'include',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(await getErrorMessage(response));
        }

        const applyConversation = (id: string) => {
          if (id !== conversationIdRef.current) {
            // A new conversation starts with a single page of history.
            setHasMore(false);
            setNextCursor(null);
          }
          setConversationId(id);
          conversationIdRef.current = id;
          window.localStorage.setItem(CONVERSATION_STORAGE_KEY, id);
        };

        let finalContent: string;
        const contentType = response.headers.get('content-type') ?? '';

        if (contentType.includes('text/event-stream')) {
          const result = await consumeChatStream(response, {
            onConversation: (conversation) => applyConversation(conversation.id),
            onStatus: (message) => setStatus(message),
            onDelta: (content) => {
              setStatus(null);
              setStreamingContent((previous) => previous + content);
            },
          });
          applyConversation(result.conversationId);
          finalContent = result.content;
        } else {
          // Fallback for deployments that still return the JSON response.
          const data = (await response.json()) as Partial<ChatResponse>;
          if (typeof data.content !== 'string' || typeof data.conversationId !== 'string') {
            throw new Error('Aya returned an invalid response.');
          }
          applyConversation(data.conversationId);
          finalContent = data.content;
        }

        setMessages((previous) => [...previous, { role: 'assistant', content: finalContent }]);
        setStreamingContent('');
        setStatus(null);
        await queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
      } catch (sendError) {
        if (isAbortError(sendError)) {
          return;
        }
        setError(
          sendError instanceof Error
            ? sendError.message
            : 'Could not reach Aya. Check that the API is running.',
        );
        setStreamingContent('');
        setStatus(null);
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          sendingRef.current = false;
          setLoading(false);
          setStatus(null);
        }
      }
    },
    [queryClient],
  );

  useEffect(() => {
    const storedId = window.localStorage.getItem(CONVERSATION_STORAGE_KEY);
    if (storedId) {
      void loadConversation(storedId, { silent: true });
    }
  }, [loadConversation]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      loadAbortRef.current?.abort();
      olderAbortRef.current?.abort();
    };
  }, []);

  const value = useMemo<ChatContextValue>(
    () => ({
      messages,
      loading,
      historyLoading,
      loadingOlder,
      hasMore,
      status,
      streamingContent,
      error,
      conversationId,
      conversations: conversationsQueryState.data ?? [],
      conversationsLoading: conversationsQueryState.isPending,
      sendMessage,
      newChat,
      loadConversation,
      loadOlderMessages,
      deleteConversation,
      refreshConversations,
      clearError,
    }),
    [
      messages,
      loading,
      historyLoading,
      loadingOlder,
      hasMore,
      status,
      streamingContent,
      error,
      conversationId,
      conversationsQueryState.data,
      conversationsQueryState.isPending,
      sendMessage,
      newChat,
      loadConversation,
      loadOlderMessages,
      deleteConversation,
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
