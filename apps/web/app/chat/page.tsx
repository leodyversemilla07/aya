'use client';

import { ChatComposer } from '@/components/chat/chat-composer';
import { ChatContextIndicator } from '@/components/chat/chat-context';
import { ChatMessages } from '@/components/chat/chat-messages';
import { useChat } from '@/components/chat/chat-provider';
import { ChatWelcome } from '@/components/chat/chat-welcome';
import { PageHeader } from '@/components/page-header';

export default function ChatPage() {
  const { usage } = useChat();

  return (
    <div className="flex h-svh flex-col">
      <PageHeader title="Chat" subtitle="Staff augmentation assistant" />

      <ChatMessages className="flex-1" emptyState={<ChatWelcome />} />

      <div className="border-t border-border bg-background p-4">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-end pb-2">
          {usage ? <ChatContextIndicator usage={usage} /> : null}
        </div>
        <ChatComposer />
      </div>
    </div>
  );
}
