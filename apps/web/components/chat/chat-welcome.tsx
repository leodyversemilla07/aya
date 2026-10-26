'use client';

import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';
import { Bot } from 'lucide-react';
import { useChat } from './chat-provider';

const SUGGESTIONS = [
  'Who is on the bench right now?',
  'What is our utilization rate?',
  'Show me contracts expiring in the next 30 days',
  'Find a React developer for a fintech project',
];

export function ChatWelcome({ compact = false }: { compact?: boolean }) {
  const { sendMessage, loading } = useChat();

  return (
    <div className={cn('text-center', compact ? 'py-8' : 'py-14')}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Bot className="h-7 w-7 text-foreground" />
      </div>
      <h3 className={cn('font-semibold text-foreground', compact ? 'text-base' : 'text-lg')}>
        Welcome to Aya
      </h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Your AI assistant for staff augmentation management. Ask about developers, clients,
        contracts, or team performance.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion}
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void sendMessage(suggestion)}
          >
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );
}
