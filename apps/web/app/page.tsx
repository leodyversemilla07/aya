'use client';

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import { Button } from '@workspace/ui/components/button';
import { Card } from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import { ScrollArea } from '@workspace/ui/components/scroll-area';
import { AlertTriangle, BarChart3, Bot, Send, User, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  { icon: Users, text: 'Who is available with React skills?' },
  { icon: BarChart3, text: 'What is our utilization rate?' },
  { icon: AlertTriangle, text: 'Show me upcoming contract renewals' },
  { icon: Users, text: 'Find a senior Flutter dev for a fintech project' },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scrollRef is a stable ref
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId }),
      });

      const data = await res.json();

      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.content }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Error: Could not connect to Aya API. Make sure the API is running on port 3001.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 border-r bg-muted/30 p-4 md:block">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight">Aya</h1>
          <p className="text-xs text-muted-foreground">Staff Augmentation Agent</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Quick Actions
          </p>
          {SUGGESTIONS.map((s, i) => (
            <button
              type="button"
              key={i}
              onClick={() => sendMessage(s.text)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
              disabled={loading}
            >
              <s.icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{s.text}</span>
            </button>
          ))}
        </div>

        <div className="mt-8 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Stats
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold">12</p>
              <p className="text-xs text-muted-foreground">Developers</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold">6</p>
              <p className="text-xs text-muted-foreground">Clients</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-green-600">92%</p>
              <p className="text-xs text-muted-foreground">Utilization</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">2</p>
              <p className="text-xs text-muted-foreground">Alerts</p>
            </Card>
          </div>
        </div>
      </aside>

      {/* Main chat area */}
      <main className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center gap-3 border-b px-6 py-4">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground">
              <Bot className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-sm font-semibold">Aya</h2>
            <p className="text-xs text-muted-foreground">Ask me about your team</p>
          </div>
        </header>

        {/* Messages */}
        <ScrollArea className="flex-1 p-6" ref={scrollRef}>
          <div className="mx-auto max-w-2xl space-y-6">
            {messages.length === 0 && (
              <div className="py-20 text-center">
                <Bot className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Welcome to Aya</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your AI assistant for staff augmentation management.
                  <br />
                  Ask me about developers, clients, contracts, or team performance.
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}

                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
                    msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p>{msg.content}</p>
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-3">
                            <table className="w-full text-xs border-collapse">{children}</table>
                          </div>
                        ),
                        thead: ({ children }) => (
                          <thead className="border-b-2 border-foreground/20">{children}</thead>
                        ),
                        th: ({ children }) => (
                          <th className="text-left px-2 py-1.5 font-semibold whitespace-nowrap">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="px-2 py-1.5 border-t border-foreground/10">{children}</td>
                        ),
                        p: ({ children }) => (
                          <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold">{children}</strong>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>
                        ),
                        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>

                {msg.role === 'user' && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-lg bg-muted px-4 py-3 text-sm">
                  <div className="flex gap-1">
                    <span className="animate-bounce">.</span>
                    <span className="animate-bounce delay-100">.</span>
                    <span className="animate-bounce delay-200">.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <footer className="border-t p-4">
          <form onSubmit={handleSubmit} className="mx-auto max-w-2xl flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Aya about your team..."
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !input.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </footer>
      </main>
    </div>
  );
}
