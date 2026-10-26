'use client';

import { ChatComposer } from '@/components/chat/chat-composer';
import { ChatMessages } from '@/components/chat/chat-messages';
import { ChatWelcome } from '@/components/chat/chat-welcome';
import { PageHeader } from '@/components/page-header';

export default function ChatPage() {
  return (
    <div className="flex h-svh flex-col">
      <PageHeader title="Chat" subtitle="Staff augmentation assistant" />

      <ChatMessages className="flex-1" emptyState={<ChatWelcome />} />

      <div className="border-t border-border bg-background p-4">
        <ChatComposer />
      </div>
    </div>
  );
}
