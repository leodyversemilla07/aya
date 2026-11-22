'use client';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@workspace/ui/components/input-group';
import { ArrowUp, Square } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useRef, useState } from 'react';
import { useChat } from './chat-provider';

export function ChatComposer({ placeholder = 'Ask about your team...' }: { placeholder?: string }) {
  const { sendMessage, stop, loading } = useChat();
  const [input, setInput] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  function submit() {
    const message = input.trim();
    if (!message || loading) return;

    setInput('');
    void sendMessage(message);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl">
      <label htmlFor="chat-input" className="sr-only">
        Message Aya
      </label>
      <InputGroup className="h-auto flex-col items-stretch bg-background py-0.5">
        <InputGroupTextarea
          id="chat-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={loading}
          maxLength={10_000}
          rows={1}
          autoComplete="off"
          enterKeyHint="send"
          aria-describedby="chat-input-hint"
          className="min-h-11 max-h-48 overflow-y-auto px-3 py-2.5"
        />
        <InputGroupAddon align="block-end" className="items-center px-2 pb-2">
          <span id="chat-input-hint" className="text-[11px] text-muted-foreground">
            Press Enter to send · Shift+Enter for a new line
          </span>
          {loading ? (
            <InputGroupButton
              type="button"
              size="icon-sm"
              variant="destructive"
              aria-label="Stop generating"
              title="Stop generating"
              className="ml-auto rounded-full"
              onClick={() => stop()}
            >
              <Square className="h-3 w-3" />
            </InputGroupButton>
          ) : (
            <InputGroupButton
              type="submit"
              size="icon-sm"
              className="ml-auto rounded-full"
              disabled={!input.trim()}
              aria-label="Send message"
              title="Send message"
            >
              <ArrowUp />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
