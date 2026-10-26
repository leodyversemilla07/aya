'use client';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Send } from 'lucide-react';
import { type FormEvent, useRef, useState } from 'react';
import { useChat } from './chat-provider';

export function ChatComposer({ placeholder = 'Ask about your team...' }: { placeholder?: string }) {
  const { sendMessage, loading } = useChat();
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    setInput('');
    void sendMessage(message);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-3xl items-end gap-2">
      <div className="flex-1">
        <label htmlFor="chat-input" className="sr-only">
          Message Aya
        </label>
        <Input
          ref={inputRef}
          id="chat-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder}
          disabled={loading}
          maxLength={10_000}
          autoComplete="off"
          enterKeyHint="send"
          aria-describedby="chat-input-hint"
          className="h-11 bg-background"
        />
        <p id="chat-input-hint" className="sr-only">
          Press Enter to send your message. Messages are limited to 10,000 characters.
        </p>
      </div>
      <Button
        type="submit"
        size="icon"
        aria-label="Send message"
        title="Send message"
        disabled={loading || !input.trim()}
        className="h-11 w-11 shrink-0"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
