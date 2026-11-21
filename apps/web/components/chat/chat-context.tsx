'use client';

import type { ChatUsage } from '@/lib/chat-stream';
import { Button } from '@workspace/ui/components/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@workspace/ui/components/hover-card';
import { Progress } from '@workspace/ui/components/progress';

function formatTokens(value: number): string {
  if (value < 1000) return String(value);
  return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
}

// Shows how much of the model context window the conversation has used.
export function ChatContextIndicator({ usage }: { usage: ChatUsage }) {
  const percent = Math.min(
    100,
    Math.round((usage.totalInputTokens / Math.max(1, usage.contextLimit)) * 100),
  );

  const rows = [
    { label: 'Input', value: usage.totalInputTokens },
    { label: 'Output', value: usage.totalOutputTokens },
    { label: 'Last reply', value: `${formatTokens(usage.outputTokens)} out` },
  ];

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={10}
        closeDelay={100}
        render={<Button type="button" variant="outline" size="sm" />}
      >
        {percent}% context
      </HoverCardTrigger>
      <HoverCardContent className="flex w-64 flex-col gap-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">Context</span>
          <span className="text-muted-foreground">
            {formatTokens(usage.totalInputTokens)} / {formatTokens(usage.contextLimit)}
          </span>
        </div>
        <Progress value={percent} aria-label="Context used" />
        <div className="flex flex-col gap-1 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{row.label}</span>
              <span>{row.value}</span>
            </div>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
