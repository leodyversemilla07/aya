'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@workspace/ui/components/sidebar';
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import { Button } from '@workspace/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import { ScrollArea } from '@workspace/ui/components/scroll-area';
import {
  Bot,
  Send,
  User,
  Users,
  UserCheck,
  UserPlus,
  BarChart3,
  FileText,
  Briefcase,
  Building2,
  TrendingUp,
  AlertTriangle,
  Home,
  Search,
  Settings,
  Bell,
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Stats data for dashboard
const STATS = [
  { label: 'Developers', value: '24', icon: Users, color: 'text-sidebar-primary', bg: 'bg-sidebar-accent' },
  { label: 'On Bench', value: '4', icon: UserCheck, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { label: 'Assigned', value: '20', icon: Briefcase, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { label: 'Clients', value: '8', icon: Building2, color: 'text-sidebar-primary', bg: 'bg-sidebar-accent' },
];

// Sidebar content component
function DashboardSidebar() {
  const { state } = useSidebar();
  const isExpanded = state === 'expanded';

  const handleQuickAction = (query: string) => {
    window.dispatchEvent(new CustomEvent('aya-chat', { detail: query }));
  };

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <Bot className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {isExpanded && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">Aya</span>
              <span className="text-xs text-sidebar-muted-foreground">Staff Augmentation</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-1 p-2">
        {/* Navigation */}
        <SidebarGroup>
          {isExpanded && (
            <SidebarGroupLabel className="text-xs font-medium text-sidebar-muted-foreground mb-1">
              Menu
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <div className="flex flex-col gap-1">
              {/* Navigation - Agent Capabilities */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleQuickAction('Search developers by skills or availability')}
                className={`justify-start gap-2 ${isExpanded ? 'px-2' : 'px-2.5 justify-center'}`}
              >
                <Users className="h-4 w-4" />
                {isExpanded && <span className="text-sm">Developer Roster</span>}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleQuickAction('Find best developers for a new project')}
                className={`justify-start gap-2 ${isExpanded ? 'px-2' : 'px-2.5 justify-center'}`}
              >
                <UserPlus className="h-4 w-4" />
                {isExpanded && <span className="text-sm">Match Talent</span>}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleQuickAction('What is our current utilization rate?')}
                className={`justify-start gap-2 ${isExpanded ? 'px-2' : 'px-2.5 justify-center'}`}
              >
                <BarChart3 className="h-4 w-4" />
                {isExpanded && <span className="text-sm">Utilization</span>}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleQuickAction('Show me contracts status and renewals')}
                className={`justify-start gap-2 ${isExpanded ? 'px-2' : 'px-2.5 justify-center'}`}
              >
                <FileText className="h-4 w-4" />
                {isExpanded && <span className="text-sm">Contracts</span>}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleQuickAction('Show team performance metrics')}
                className={`justify-start gap-2 ${isExpanded ? 'px-2' : 'px-2.5 justify-center'}`}
              >
                <TrendingUp className="h-4 w-4" />
                {isExpanded && <span className="text-sm">Performance</span>}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleQuickAction('Show all active risk alerts')}
                className={`justify-start gap-2 ${isExpanded ? 'px-2' : 'px-2.5 justify-center'}`}
              >
                <AlertTriangle className="h-4 w-4" />
                {isExpanded && <span className="text-sm">Alerts</span>}
              </Button>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-1 bg-sidebar-border" />

        {/* Quick Actions - Agent Capabilities */}
        <SidebarGroup>
          {isExpanded && (
            <SidebarGroupLabel className="text-xs font-medium text-sidebar-muted-foreground mb-1">
              Quick Actions
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleQuickAction('Show me developers on the bench')}
                className={`justify-start gap-2 ${isExpanded ? 'px-2' : 'px-2.5 justify-center'}`}
              >
                <UserCheck className="h-4 w-4" />
                {isExpanded && <span className="text-sm truncate">Bench Status</span>}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleQuickAction('What is our utilization rate?')}
                className={`justify-start gap-2 ${isExpanded ? 'px-2' : 'px-2.5 justify-center'}`}
              >
                <BarChart3 className="h-4 w-4" />
                {isExpanded && <span className="text-sm truncate">Utilization</span>}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleQuickAction('Show me contracts expiring this month')}
                className={`justify-start gap-2 ${isExpanded ? 'px-2' : 'px-2.5 justify-center'}`}
              >
                <FileText className="h-4 w-4" />
                {isExpanded && <span className="text-sm truncate">Renewals</span>}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleQuickAction('Show all active risk alerts')}
                className={`justify-start gap-2 ${isExpanded ? 'px-2' : 'px-2.5 justify-center'}`}
              >
                <AlertTriangle className="h-4 w-4" />
                {isExpanded && <span className="text-sm truncate">Alerts</span>}
              </Button>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  );
}

// Stats cards component
function StatsCards() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {STATS.map((stat, i) => (
        <Card key={i} className={stat.bg}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-sidebar-foreground">{stat.value}</p>
                <p className="text-xs text-sidebar-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Quick actions for dashboard
function DashboardQuickActions({ onAction }: { onAction: (query: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => onAction('Show me developers on the bench')}>
        <UserCheck className="mr-2 h-4 w-4 text-amber-500" />
        Bench Status
      </Button>
      <Button variant="outline" size="sm" onClick={() => onAction('What is our utilization rate?')}>
        <BarChart3 className="mr-2 h-4 w-4 text-emerald-500" />
        Utilization
      </Button>
      <Button variant="outline" size="sm" onClick={() => onAction('Show me contracts expiring this month')}>
        <FileText className="mr-2 h-4 w-4 text-red-500" />
        Renewals
      </Button>
      <Button variant="outline" size="sm" onClick={() => onAction('Show me all active alerts')}>
        <Bell className="mr-2 h-4 w-4 text-orange-500" />
        Alerts
      </Button>
    </div>
  );
}

export default function DashboardPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleChat = (e: CustomEvent) => {
      sendMessage(e.detail);
    };
    window.addEventListener('aya-chat', handleChat as EventListener);
    return () => window.removeEventListener('aya-chat', handleChat as EventListener);
  }, [loading, conversationId]);

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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('NEXT_PUBLIC_API_URL not configured');
      }
      const res = await fetch(`${apiUrl}/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId }),
      });

      if (!res.ok) {
        const errorMsg = `Error: ${res.status} - Could not connect to Aya API`;
        setMessages((prev) => [...prev, { role: 'assistant', content: errorMsg }]);
        setLoading(false);
        return;
      }

      const data = await res.json();

      if (!data || typeof data.content !== 'string') {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Error: Invalid response from API' }]);
        setLoading(false);
        return;
      }

      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.content }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Error: Could not connect to Aya API. Make sure the API is running on port 3001.',
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
    <SidebarProvider defaultOpen={true}>
      <Sidebar side="left" variant="sidebar" collapsible="icon">
        <DashboardSidebar />
      </Sidebar>

      <SidebarInset>
        <div className="flex flex-1 flex-col h-screen">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-sidebar-border bg-sidebar px-6 py-3">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <Avatar className="h-9 w-9 border-2 border-sidebar-border">
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm font-semibold">
                  A
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-sm font-semibold text-sidebar-foreground">Aya</h2>
                <p className="text-xs text-sidebar-muted-foreground">AI Staff Augmentation</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-sidebar-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                Online
              </div>
            </div>
          </header>

          {/* Main Content */}
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Welcome & Stats */}
              <div className="space-y-4">
                <div>
                  <h1 className="text-2xl font-bold text-sidebar-foreground">Dashboard</h1>
                  <p className="text-sm text-sidebar-muted-foreground">Welcome back! Here's your team overview.</p>
                </div>
                <StatsCards />
              </div>

              {/* Quick Actions */}
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-sidebar-foreground">Quick Actions</h2>
                <DashboardQuickActions onAction={sendMessage} />
              </div>

              {/* Chat Section */}
              <div className="space-y-4 border-t border-sidebar-border pt-6">
                <h2 className="text-lg font-semibold text-sidebar-foreground">Chat with Aya</h2>
                
                {messages.length === 0 && (
                  <div className="py-8 text-center border border-dashed border-sidebar-border rounded-lg">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sidebar-accent">
                      <Bot className="h-6 w-6 text-sidebar-foreground" />
                    </div>
                    <p className="text-sm text-sidebar-muted-foreground">
                      Ask about developers, clients, contracts, or team performance
                    </p>
                  </div>
                )}

                {/* Messages */}
                <div className="space-y-4">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                      {msg.role === 'assistant' && (
                        <Avatar className="h-8 w-8 shrink-0 border border-sidebar-border">
                          <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">A</AvatarFallback>
                        </Avatar>
                      )}

                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                          msg.role === 'user'
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                            : 'bg-sidebar-accent text-sidebar-foreground border border-sidebar-border'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          <p>{msg.content}</p>
                        ) : (
                          <div className="text-sidebar-foreground">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                table: ({ children }) => (
                                  <div className="my-3 overflow-hidden rounded-lg border border-sidebar-border">
                                    <table className="w-full text-xs">{children}</table>
                                  </div>
                                ),
                                thead: ({ children }) => (
                                  <thead className="bg-sidebar-accent">{children}</thead>
                                ),
                                th: ({ children }) => (
                                  <th className="border-b border-sidebar-border px-3 py-2 text-left font-semibold">
                                    {children}
                                  </th>
                                ),
                                td: ({ children }) => (
                                  <td className="border-b border-sidebar-border px-3 py-2">{children}</td>
                                ),
                                p: ({ children }) => (
                                  <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                                ),
                                strong: ({ children }) => (
                                  <strong className="font-semibold">{children}</strong>
                                ),
                                ul: ({ children }) => (
                                  <ul className="mb-2 list-disc pl-4">{children}</ul>
                                ),
                                ol: ({ children }) => (
                                  <ol className="mb-2 list-decimal pl-4">{children}</ol>
                                ),
                                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                                h1: ({ children }) => (
                                  <h1 className="mb-2 text-lg font-bold">{children}</h1>
                                ),
                                h2: ({ children }) => (
                                  <h2 className="mb-2 text-base font-semibold">{children}</h2>
                                ),
                                h3: ({ children }) => (
                                  <h3 className="mb-1 text-sm font-semibold">{children}</h3>
                                ),
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>

                      {msg.role === 'user' && (
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground">
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}

                  {loading && (
                    <div className="flex gap-3">
                      <Avatar className="h-8 w-8 shrink-0 border border-sidebar-border">
                        <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">A</AvatarFallback>
                      </Avatar>
                      <div className="rounded-2xl bg-sidebar-accent border border-sidebar-border px-4 py-3">
                        <div className="flex gap-1">
                          <span className="h-2 w-2 rounded-full bg-sidebar-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="h-2 w-2 rounded-full bg-sidebar-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="h-2 w-2 rounded-full bg-sidebar-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Input */}
          <footer className="border-t border-sidebar-border bg-sidebar p-4">
            <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your team..."
                disabled={loading}
                className="h-11 border-sidebar-border bg-sidebar-accent"
              />
              <Button
                type="submit"
                disabled={loading || !input.trim()}
                size="icon"
                className="h-11 w-11 bg-sidebar-primary hover:bg-sidebar-primary/90"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </footer>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}