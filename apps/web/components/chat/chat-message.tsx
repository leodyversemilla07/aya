'use client';

import type { ChatMessage as ChatMessageType } from '@/lib/types';
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import { cn } from '@workspace/ui/lib/utils';
import { Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3', isUser && 'justify-end')}>
      {!isUser && (
        <Avatar className="mt-0.5 h-8 w-8 shrink-0 border border-border">
          <AvatarFallback className="bg-primary text-xs text-primary-foreground">A</AvatarFallback>
        </Avatar>
      )}

      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm md:max-w-[78%]',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'border border-border bg-muted/60 text-foreground',
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        ) : (
          <div className="min-w-0 break-words">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({ children }) => (
                  <div className="my-3 w-full overflow-x-auto rounded-lg border border-border">
                    <table className="w-full min-w-[36rem] border-collapse text-xs">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
                th: ({ children }) => (
                  <th className="border-b border-border px-3 py-2 text-left font-semibold">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border-b border-border px-3 py-2 align-top">{children}</td>
                ),
                p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                ul: ({ children }) => <ul className="mb-2 list-disc pl-4">{children}</ul>,
                ol: ({ children }) => <ol className="mb-2 list-decimal pl-4">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                h1: ({ children }) => <h1 className="mb-2 text-lg font-bold">{children}</h1>,
                h2: ({ children }) => <h2 className="mb-2 text-base font-semibold">{children}</h2>,
                h3: ({ children }) => <h3 className="mb-1 text-sm font-semibold">{children}</h3>,
                a: ({ children, href }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-medium text-primary underline underline-offset-4"
                  >
                    {children}
                  </a>
                ),
                pre: ({ children }) => (
                  <pre className="my-3 overflow-x-auto rounded-lg bg-background/80 p-3 text-xs">
                    {children}
                  </pre>
                ),
                code: ({ children }) => (
                  <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-[0.85em]">
                    {children}
                  </code>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground">
                    {children}
                  </blockquote>
                ),
                hr: () => <hr className="my-4 border-border" />,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {isUser && (
        <Avatar className="mt-0.5 h-8 w-8 shrink-0">
          <AvatarFallback className="bg-muted text-muted-foreground">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

export function ChatTypingIndicator() {
  return (
    <output className="flex gap-3" aria-label="Aya is thinking">
      <Avatar className="mt-0.5 h-8 w-8 shrink-0 border border-border">
        <AvatarFallback className="bg-primary text-xs text-primary-foreground">
          <Bot className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <span className="block rounded-2xl border border-border bg-muted/60 px-4 py-3">
        <span className="flex gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
      </span>
    </output>
  );
}
