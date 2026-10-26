'use client';

import { ChatComposer } from '@/components/chat/chat-composer';
import { ChatMessages } from '@/components/chat/chat-messages';
import { useChat } from '@/components/chat/chat-provider';
import { ChatWelcome } from '@/components/chat/chat-welcome';
import { PageHeader } from '@/components/page-header';
import { useRef } from 'react';
import { DashboardQuickActions } from './dashboard-quick-actions';
import { StatsCards } from './stats-cards';

export function DashboardPage() {
  const chatRef = useRef<HTMLDivElement>(null);
  const { sendMessage } = useChat();

  const handleAction = (query: string) => {
    void sendMessage(query);
    chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader title="Dashboard" subtitle="Team overview and Aya assistant" />

      <div className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-6xl space-y-8">
          <section className="space-y-4" aria-labelledby="overview-heading">
            <div>
              <h2 id="overview-heading" className="text-2xl font-semibold tracking-tight">
                Welcome back
              </h2>
              <p className="text-sm text-muted-foreground">
                Here is your live team overview, pulled from the Aya database.
              </p>
            </div>
            <StatsCards />
          </section>

          <section className="space-y-3" aria-labelledby="quick-actions-heading">
            <div>
              <h2 id="quick-actions-heading" className="text-lg font-semibold tracking-tight">
                Quick actions
              </h2>
              <p className="text-sm text-muted-foreground">
                Ask Aya a common staffing question with one click.
              </p>
            </div>
            <DashboardQuickActions onAction={handleAction} />
          </section>

          <section ref={chatRef} className="scroll-mt-20 space-y-3" aria-labelledby="chat-heading">
            <div>
              <h2 id="chat-heading" className="text-lg font-semibold tracking-tight">
                Chat with Aya
              </h2>
              <p className="text-sm text-muted-foreground">
                Ask about developers, clients, contracts, or team performance.
              </p>
            </div>

            <div className="flex h-[34rem] flex-col overflow-hidden rounded-xl border border-border bg-card">
              <ChatMessages emptyState={<ChatWelcome compact />} />
              <div className="border-t border-border p-3">
                <ChatComposer />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
