'use client';

import type { ChatMessage as ChatMessageType, ChatToolStep } from '@/lib/types';
import { Bubble, BubbleContent } from '@workspace/ui/components/bubble';
import { Button } from '@workspace/ui/components/button';
import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockCopyButton,
} from '@workspace/ui/components/code-block';
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
} from '@workspace/ui/components/message';
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@workspace/ui/components/trace';
import { cn } from '@workspace/ui/lib/utils';
import { Bot, Check, Copy, User, Wrench } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatCodeBlock } from './chat-code-block';

const TOOL_LABELS: Record<string, string> = {
  query_roster: 'Searching the developer roster',
  match_developers: 'Matching developers to the requirement',
  get_utilization: 'Checking utilization',
  check_contracts: 'Reviewing contracts',
  get_performance: 'Reviewing performance data',
  get_alerts: 'Scanning for risks',
  forecast_capacity: 'Forecasting capacity and backfills',
};

function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? `Running ${name}`;
}

function formatStepValue(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function ToolSteps({ steps }: { steps: ChatToolStep[] }) {
  if (steps.length === 0) return null;

  return (
    <Trace>
      {steps.map((step) =>
        step.state === 'done' ? (
          <TraceCollapsible key={step.key}>
            <TraceCollapsibleTrigger>
              <TraceLine>
                <TraceIcon>
                  <Wrench />
                </TraceIcon>
                <TraceTitle>{step.label}</TraceTitle>
              </TraceLine>
            </TraceCollapsibleTrigger>
            <TraceCollapsibleContent className="w-full min-w-0">
              {step.input !== undefined && (
                <CodeBlock size="sm" title="Input">
                  <CodeBlockContent wrap className="max-h-48">
                    {formatStepValue(step.input)}
                  </CodeBlockContent>
                </CodeBlock>
              )}
              {step.output !== undefined && (
                <CodeBlock size="sm" title="Result">
                  <CodeBlockContent wrap className="max-h-64">
                    {formatStepValue(step.output)}
                  </CodeBlockContent>
                </CodeBlock>
              )}
            </TraceCollapsibleContent>
          </TraceCollapsible>
        ) : (
          <TraceLine key={step.key} status="running">
            <TraceIcon>
              <Wrench />
            </TraceIcon>
            <TraceTitle>{step.label}</TraceTitle>
          </TraceLine>
        ),
      )}
    </Trace>
  );
}

const markdownComponents = {
  table: ({ children }: { children?: ReactNode }) => (
    <div className="my-3 w-full overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[36rem] border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: ReactNode }) => <thead className="bg-muted">{children}</thead>,
  th: ({ children }: { children?: ReactNode }) => (
    <th className="border-b border-border px-3 py-2 text-left font-semibold">{children}</th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border-b border-border px-3 py-2 align-top">{children}</td>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mb-2 leading-relaxed last:mb-0">{children}</p>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mb-2 list-disc pl-4">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="mb-2 list-decimal pl-4">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="mb-2 text-lg font-bold">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mb-2 text-base font-semibold">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mb-1 text-sm font-semibold">{children}</h3>
  ),
  a: ({ children, href }: { children?: ReactNode; href?: string }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="font-medium text-primary underline underline-offset-4"
    >
      {children}
    </a>
  ),
  pre: ({ children }: { children?: ReactNode }) => <ChatCodeBlock>{children}</ChatCodeBlock>,
  code: ({ children }: { children?: ReactNode }) => (
    <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-border" />,
};

function AssistantCopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label="Copy reply"
      className="text-muted-foreground"
      onClick={() => {
        void navigator.clipboard?.writeText(content);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}

export function ChatMessage({
  message,
  streaming = false,
}: {
  message: ChatMessageType;
  streaming?: boolean;
}) {
  const isUser = message.role === 'user';
  const steps = message.steps ?? [];

  return (
    <Message align={isUser ? 'end' : 'start'}>
      <MessageAvatar
        className={cn(
          'h-8 w-8 border border-border',
          isUser ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground',
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </MessageAvatar>
      <MessageContent className={cn(streaming && 'min-h-10')}>
        {isUser ? (
          <Bubble align="end" variant="default">
            <BubbleContent className="whitespace-pre-wrap">{message.content}</BubbleContent>
          </Bubble>
        ) : (
          <>
            {steps.length > 0 && <ToolSteps steps={steps} />}
            <div className="min-w-0 break-words text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {message.content}
              </ReactMarkdown>
              {streaming && (
                <span
                  className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-foreground/70 align-text-bottom"
                  aria-hidden="true"
                />
              )}
            </div>
            {!streaming && message.content && (
              <MessageFooter>
                <AssistantCopyButton content={message.content} />
              </MessageFooter>
            )}
          </>
        )}
      </MessageContent>
    </Message>
  );
}

export function ChatTypingIndicator({ status }: { status?: string | null }) {
  return (
    <output className="flex gap-3" aria-label={status ?? 'Aya is thinking'}>
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-primary text-primary-foreground">
        <Bot className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="flex items-center gap-2 rounded-2xl border border-border bg-muted/60 px-4 py-3">
        <span className="flex gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
        {status && <span className="text-xs text-muted-foreground">{status}</span>}
      </span>
    </output>
  );
}
