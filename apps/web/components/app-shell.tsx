'use client';

import { Sidebar, SidebarInset, SidebarProvider } from '@workspace/ui/components/sidebar';
import type { ReactNode } from 'react';
import { AppSidebar } from './app-sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <Sidebar side="left" variant="sidebar" collapsible="icon">
        <AppSidebar />
      </Sidebar>
      <SidebarInset className="min-h-svh">{children}</SidebarInset>
    </SidebarProvider>
  );
}
