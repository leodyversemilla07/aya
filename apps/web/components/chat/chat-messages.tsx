'use client';

import { Button } from '@workspace/ui/components/button';
import { Marker, MarkerContent } from '@workspace/ui/components/marker';
import { cn } from '@workspace/ui/lib/utils';
import { AlertCircle, ArrowDown, History } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ChatMessage, ChatTypingIndicator } from './chat-message';
import { useChat } from './chat-provider';

interface ChatMessagesProps {
  emptyState?: ReactNode;
  className?: string;
}

export function ChatMessages({ emptyState, className }: ChatMessagesProps) {
  const {
    messages,
    loading,
    historyLoading,
    loadingOlder,
    hasMore,
    status,
    streamingContent,
    toolSteps,
    error,
    clearError,
    loadOlderMessages,
  } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  // Only keep the newest turn in view when the reader is already there;
  // otherwise surface a jump-to-latest button instead of yanking the scroll.
  // biome-ignore lint/correctness/useExhaustiveDependencies: new messages and streamed tokens should scroll the view.
  useEffect(() => {
    if (atBottom) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, loading, streamingContent, toolSteps, status]);

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    setAtBottom(container.scrollHeight - container.scrollTop - container.clientHeight < 80);
  };

  const jumpToLatest = () => {
    setAtBottom(true);
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  return (
    <div className="relative flex min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn('flex-1 overflow-y-auto', className)}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={loading || historyLoading || loadingOlder}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
          {historyLoading ? (
            <output className="block py-10 text-center text-sm text-muted-foreground">
              Loading conversation...
            </output>
          ) : (
            <>
              {hasMore && (
                <Marker variant="separator" className="text-xs">
                  <MarkerContent>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void loadOlderMessages()}
                      disabled={loadingOlder}
                    >
                      <History aria-hidden="true" />
                      {loadingOlder ? 'Loading…' : 'Load earlier messages'}
                    </Button>
                  </MarkerContent>
                </Marker>
              )}

              {messages.length === 0 && emptyState}

              {messages.map((message, index) => (
                <ChatMessage key={message.id ?? `${message.role}-${index}`} message={message} />
              ))}

              {streamingContent && (
                <ChatMessage
                  message={{ role: 'assistant', content: streamingContent, steps: toolSteps }}
                  streaming
                />
              )}

              {!streamingContent && toolSteps.length > 0 && (
                <ChatMessage
                  message={{ role: 'assistant', content: '', steps: toolSteps }}
                  streaming
                />
              )}

              {loading && !streamingContent && toolSteps.length === 0 && (
                <ChatTypingIndicator status={status} />
              )}
            </>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="flex-1">{error}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearError}
                className="h-6 px-2 text-xs text-destructive hover:bg-destructive/10"
              >
                Dismiss
              </Button>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {!atBottom && (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Jump to latest"
          onClick={jumpToLatest}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-md"
        >
          <ArrowDown aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
