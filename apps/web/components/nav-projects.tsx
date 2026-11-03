'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@workspace/ui/components/sidebar';
import { Copy, MessageSquare, MoreHorizontal } from 'lucide-react';

export function NavProjects({
  conversations,
  activeId,
  loading,
  onSelect,
}: {
  conversations: { id: string; title: string }[];
  activeId?: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
}) {
  const { isMobile } = useSidebar();

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Recent chats</SidebarGroupLabel>
      <SidebarMenu>
        {loading && (
          <SidebarMenuItem className="px-2 py-2 text-xs text-muted-foreground">
            Loading chats…
          </SidebarMenuItem>
        )}
        {!loading && conversations.length === 0 && (
          <SidebarMenuItem className="px-2 py-2 text-xs text-muted-foreground">
            No conversations yet.
          </SidebarMenuItem>
        )}
        {conversations.slice(0, 8).map((conversation) => (
          <SidebarMenuItem key={conversation.id}>
            <SidebarMenuButton
              isActive={conversation.id === activeId}
              onClick={() => onSelect(conversation.id)}
              tooltip={conversation.title}
            >
              <MessageSquare />
              <span>{conversation.title}</span>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction showOnHover>
                  <MoreHorizontal />
                  <span className="sr-only">More</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-48 rounded-lg"
                side={isMobile ? 'bottom' : 'right'}
                align={isMobile ? 'end' : 'start'}
              >
                <DropdownMenuItem onClick={() => onSelect(conversation.id)}>
                  <MessageSquare className="text-muted-foreground" />
                  Open chat
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => void navigator.clipboard?.writeText(conversation.title)}
                >
                  <Copy className="text-muted-foreground" />
                  Copy title
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>Delete chat</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
