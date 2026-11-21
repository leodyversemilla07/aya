'use client';

import { Badge } from '@workspace/ui/components/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@workspace/ui/components/collapsible';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@workspace/ui/components/sidebar';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

export type NavMainItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  isActive?: boolean;
  onClick?: () => void;
  badge?: number;
  items?: { title: string; url: string; onClick?: () => void }[];
};

export function NavMain({ items, label = 'Platform' }: { items: NavMainItem[]; label?: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) =>
          item.items?.length ? (
            <Collapsible
              key={item.title}
              defaultOpen={item.isActive}
              className="group/collapsible"
              render={<SidebarMenuItem />}
            >
              <CollapsibleTrigger
                render={<SidebarMenuButton isActive={item.isActive} tooltip={item.title} />}
              >
                <item.icon />
                <span>{item.title}</span>
                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[open]/collapsible:rotate-90" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {item.items.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton
                        render={<Link href={subItem.url} onClick={subItem.onClick} />}
                      >
                        <span>{subItem.title}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <Collapsible
              key={item.title}
              className="group/collapsible"
              render={<SidebarMenuItem />}
            >
              <SidebarMenuButton
                render={<Link href={item.url} onClick={item.onClick} />}
                isActive={item.isActive}
                tooltip={item.title}
              >
                <item.icon />
                <span>{item.title}</span>
                {item.badge && item.badge > 0 ? (
                  <Badge
                    variant="secondary"
                    className="ml-auto px-1.5 py-0 text-[10px] group-data-[collapsible=icon]:hidden"
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </Badge>
                ) : null}
              </SidebarMenuButton>
            </Collapsible>
          ),
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
