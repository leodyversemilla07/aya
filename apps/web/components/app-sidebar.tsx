'use client';

import { Button } from '@workspace/ui/components/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from '@workspace/ui/components/sidebar';
import {
  AlertTriangle,
  BarChart3,
  FileText,
  Home,
  MessageSquare,
  Plus,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import type React from 'react';
import { useChat } from './chat/chat-provider';
import { NavMain } from './nav-main';
import { NavProjects } from './nav-projects';
import { NavUser } from './nav-user';
import { TeamSwitcher } from './team-switcher';

const navigation = [
  { title: 'Dashboard', url: '/', icon: Home },
  { title: 'Chat', url: '/chat', icon: MessageSquare },
];

const capabilities = [
  ['Developer Roster', Users, 'Search developers by skills or availability'],
  ['Match Talent', UserPlus, 'Find the best developers for a new project'],
  ['Utilization', BarChart3, 'What is our current utilization rate?'],
  ['Contracts', FileText, 'Show me contract status and upcoming renewals'],
  ['Performance', TrendingUp, 'Show team performance metrics'],
  ['Alerts', AlertTriangle, 'Show all active risk alerts'],
] as const;

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { isMobile, setOpenMobile } = useSidebar();
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
  const close = () => isMobile && setOpenMobile(false);

  const goToChat = (query?: string) => {
    close();
    if (pathname !== '/chat') router.push('/chat');
    if (query) void sendMessage(query);
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <div className="px-2 pt-2">
          <Button
            className="w-full justify-start gap-2 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2!"
            onClick={() => {
              close();
              newChat();
              goToChat();
            }}
          >
            <Plus className="size-4" />
            <span className="group-data-[collapsible=icon]:hidden">New Chat</span>
          </Button>
        </div>
        <NavMain items={navigation.map((item) => ({ ...item, isActive: pathname === item.url }))} />
        <NavMain
          label="Capabilities"
          items={capabilities.map(([title, icon, query]) => ({
            title,
            url: '/chat',
            icon,
            isActive: false,
            onClick: () => goToChat(query),
          }))}
        />
        <NavProjects
          conversations={conversations}
          activeId={conversationId}
          loading={conversationsLoading}
          onSelect={(id) => {
            close();
            void loadConversation(id);
            if (pathname !== '/chat') router.push('/chat');
          }}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
