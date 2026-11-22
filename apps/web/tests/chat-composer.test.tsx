import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChatComposer } from '../components/chat/chat-composer';
import { ChatMessages } from '../components/chat/chat-messages';
import { ChatProvider } from '../components/chat/chat-provider';
import { jsonResponse, renderWithQueryClient, sseEvent, sseResponse } from './test-utils';

describe('ChatComposer', () => {
  it('sends the typed message through the streaming endpoint and clears the input', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.endsWith('/conversations')) return jsonResponse([]);
      if (url.endsWith('/agent/chat/stream')) {
        return sseResponse([
          sseEvent('conversation', { id: 'conv-1', title: 'Who is on the bench?' }),
          sseEvent('delta', { content: 'Hello from Aya' }),
          sseEvent('done', { conversationId: 'conv-1', content: 'Hello from Aya' }),
        ]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithQueryClient(
      <ChatProvider>
        <ChatComposer />
      </ChatProvider>,
    );

    const input = screen.getByLabelText('Message Aya');
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();

    await user.type(input, 'Who is on the bench?');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3001/agent/chat/stream',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            message: 'Who is on the bench?',
            conversationId: null,
          }),
        }),
      );
    });
    expect(input).toHaveValue('');
  });

  it('stops a streaming turn and keeps the partial reply as a message', async () => {
    const user = userEvent.setup();
    const encoder = new TextEncoder();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url.endsWith('/conversations')) return jsonResponse([]);
      if (url.endsWith('/agent/chat/stream')) {
        const signal = init?.signal;
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              encoder.encode(sseEvent('delta', { content: 'Partial reply from Aya' })),
            );
            // The stream stays open until the provider aborts the request.
            signal?.addEventListener('abort', () => {
              controller.error(new DOMException('The request was aborted.', 'AbortError'));
            });
          },
        });
        return new Response(body, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithQueryClient(
      <ChatProvider>
        <ChatMessages />
        <ChatComposer />
      </ChatProvider>,
    );

    const input = screen.getByLabelText('Message Aya');
    await user.type(input, 'Who is on the bench?');
    await user.keyboard('[Enter]');

    const stopButton = await screen.findByRole('button', { name: 'Stop generating' });
    await user.click(stopButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Send message' })).toBeVisible();
    });
    // The partial reply is committed as a real message instead of vanishing.
    expect(screen.getByText('Partial reply from Aya')).toBeVisible();
  });
});
