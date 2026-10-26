'use client';

import { Button } from '@workspace/ui/components/button';
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarSeparator,
  useSidebar,
} from '@workspace/ui/components/sidebar';
import { Skeleton } from '@workspace/ui/components/skeleton';
import { cn } from '@workspace/ui/lib/utils';
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Building2,
  FileText,
  Home,
  MessageSquare,
  Plus,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useChat } from './chat/chat-provider';

const NAVIGATION = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
];

const CAPABILITIES = [
  {
    label: 'Developer Roster',
    icon: Users,
    query: 'Search developers by skills or availability',
  },
  {
    label: 'Match Talent',
    icon: UserPlus,
    query: 'Find the best developers for a new project',
  },
  {
    label: 'Utilization',
    icon: BarChart3,
    query: 'What is our current utilization rate?',
  },
  {
    label: 'Contracts',
    icon: FileText,
    query: 'Show me contract status and upcoming renewals',
  },
  {
    label: 'Performance',
    icon: TrendingUp,
    query: 'Show team performance metrics',
  },
  {
    label: 'Alerts',
    icon: AlertTriangle,
    query: 'Show all active risk alerts',
  },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const isExpanded = isMobile || state === 'expanded';
  const pathname = usePathname();
  const router = useRouter();
  const {
    conversations,
    conversationsLoading,
    conversationId,
    loadConversation,
    newChat,
    sendMessage,
  } = useChat();

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };

  const goToChat = (query?: string) => {
    closeMobileSidebar();
    if (pathname !== '/chat') {
      router.push('/chat');
    }
    if (query) {
      void sendMessage(query);
    }
  };

  const handleNewChat = () => {
    closeMobileSidebar();
    newChat();
    if (pathname !== '/chat') {
      router.push('/chat');
    }
  };

  const handleConversation = (id: string) => {
    closeMobileSidebar();
    void loadConversation(id);
    if (pathname !== '/chat') {
      router.push('/chat');
    }
  };

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border">
        <Link
          href="/"
          onClick={closeMobileSidebar}
          className={cn(
            'flex items-center gap-2 rounded-lg px-2 py-3 transition-colors hover:bg-sidebar-accent',
            !isExpanded && 'justify-center',
          )}
          title="Aya home"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
            <Bot className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {isExpanded && (
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">Aya</span>
              <span className="truncate text-xs text-muted-foreground">Staff Augmentation</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-1 p-2">
        <Button
          type="button"
          size="sm"
          onClick={handleNewChat}
          className={cn('w-full gap-2', isExpanded ? 'px-2' : 'justify-center px-2.5')}
          title="Start a new chat"
        >
          <Plus className="h-4 w-4" />
          {isExpanded && <span className="text-sm">New Chat</span>}
        </Button>

        <SidebarSeparator className="my-1 bg-sidebar-border" />

        <SidebarGroup>
          {isExpanded && (
            <SidebarGroupLabel className="mb-1 text-xs font-medium">Menu</SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <nav className="flex flex-col gap-1" aria-label="Main navigation">
              {NAVIGATION.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Button
                    key={item.href}
                    asChild
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'justify-start gap-2',
                      isExpanded ? 'px-2' : 'justify-center px-2.5',
                    )}
                  >
                    <Link
                      href={item.href}
                      onClick={closeMobileSidebar}
                      aria-current={isActive ? 'page' : undefined}
                      title={item.label}
                    >
                      <item.icon className="h-4 w-4" />
                      {isExpanded && <span className="text-sm">{item.label}</span>}
                    </Link>
                  </Button>
                );
              })}
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {isExpanded && (
            <SidebarGroupLabel className="mb-1 text-xs font-medium">Capabilities</SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <div className="flex flex-col gap-1">
              {CAPABILITIES.map((capability) => (
                <Button
                  key={capability.label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => goToChat(capability.query)}
                  className={cn(
                    'justify-start gap-2',
                    isExpanded ? 'px-2' : 'justify-center px-2.5',
                  )}
                  title={capability.label}
                >
                  <capability.icon className="h-4 w-4" />
                  {isExpanded && <span className="truncate text-sm">{capability.label}</span>}
                </Button>
              ))}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-1 bg-sidebar-border" />

        <SidebarGroup className="min-h-0">
          {isExpanded && (
            <SidebarGroupLabel className="mb-1 text-xs font-medium">Recent chats</SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <div className="flex flex-col gap-1" aria-label="Conversation history">
              {conversationsLoading && isExpanded && (
                <>
                  <Skeleton className="h-7 w-full" />
                  <Skeleton className="h-7 w-4/5" />
                  <Skeleton className="h-7 w-3/5" />
                </>
              )}

              {!conversationsLoading &&
                conversations.slice(0, 8).map((conversation) => (
                  <Button
                    key={conversation.id}
                    type="button"
                    variant={conversation.id === conversationId ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => handleConversation(conversation.id)}
                    className={cn(
                      'justify-start gap-2',
                      isExpanded ? 'px-2' : 'justify-center px-2.5',
                    )}
                    title={conversation.title}
                  >
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    {isExpanded && <span className="truncate text-sm">{conversation.title}</span>}
                  </Button>
                ))}

              {!conversationsLoading && conversations.length === 0 && isExpanded && (
                <p className="px-2 py-1 text-xs text-muted-foreground">No conversations yet.</p>
              )}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <div
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground',
                !isExpanded && 'justify-center px-0',
              )}
              title="Aya staff augmentation assistant"
            >
              <Building2 className="h-4 w-4 shrink-0" />
              {isExpanded && <span className="truncate">Whitecloak workspace</span>}
            </div>
            <div
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground',
                !isExpanded && 'justify-center px-0',
              )}
              title="On bench developers are highlighted in the dashboard"
            >
              <UserCheck className="h-4 w-4 shrink-0" />
              {isExpanded && <span className="truncate">Bench-aware matching</span>}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  );
}
