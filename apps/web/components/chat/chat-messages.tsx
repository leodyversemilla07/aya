'use client';

import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';
import { AlertCircle } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { ChatMessage, ChatTypingIndicator } from './chat-message';
import { useChat } from './chat-provider';

interface ChatMessagesProps {
  emptyState?: ReactNode;
  className?: string;
}

export function ChatMessages({ emptyState, className }: ChatMessagesProps) {
  const { messages, loading, historyLoading, error, clearError } = useChat();
  const endRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: new messages and the typing indicator should scroll the view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  return (
    <div
      className={cn('flex-1 overflow-y-auto', className)}
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
      aria-busy={loading || historyLoading}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
        {historyLoading ? (
          <output className="block py-10 text-center text-sm text-muted-foreground">
            Loading conversation...
          </output>
        ) : (
          <>
            {messages.length === 0 && emptyState}

            {messages.map((message, index) => (
              <ChatMessage key={message.id ?? `${message.role}-${index}`} message={message} />
            ))}

            {loading && <ChatTypingIndicator />}
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
  );
}
