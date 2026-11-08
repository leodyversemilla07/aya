import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChatComposer } from '../components/chat/chat-composer';
import { ChatMessages } from '../components/chat/chat-messages';
import { ChatProvider } from '../components/chat/chat-provider';
import { jsonResponse, renderWithQueryClient, sseEvent, sseResponse } from './test-utils';

function renderChat() {
  return renderWithQueryClient(
    <ChatProvider>
      <ChatMessages />
      <ChatComposer />
    </ChatProvider>,
  );
}

describe('streaming chat', () => {
  it('shows status updates and streamed tokens before the reply completes', async () => {
    const user = userEvent.setup();
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(streamController) {
        controller = streamController;
      },
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = init?.method ?? 'GET';
      if (method === 'GET' && url.endsWith('/conversations')) return jsonResponse([]);
      if (method === 'POST' && url.endsWith('/agent/chat/stream')) {
        return new Response(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderChat();

    await user.type(screen.getByLabelText('Message Aya'), 'Who is on the bench?');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    const encoder = new TextEncoder();
    await act(async () => {
      controller.enqueue(
        encoder.encode(sseEvent('conversation', { id: 'conv-1', title: 'Who is on the bench?' })),
      );
      controller.enqueue(
        encoder.encode(sseEvent('status', { message: 'Searching the developer roster…' })),
      );
    });

    expect(await screen.findByText('Searching the developer roster…')).toBeInTheDocument();

    await act(async () => {
      controller.enqueue(encoder.encode(sseEvent('delta', { content: '**Ada**' })));
    });

    expect(await screen.findByText('Ada')).toBeInTheDocument();
    expect(screen.queryByText('Searching the developer roster…')).not.toBeInTheDocument();

    await act(async () => {
      controller.enqueue(encoder.encode(sseEvent('delta', { content: ' is available.' })));
      controller.enqueue(
        encoder.encode(
          sseEvent('done', {
            conversationId: 'conv-1',
            content: '**Ada** is available.',
          }),
        ),
      );
      controller.close();
    });

    await waitFor(() => {
      expect(screen.getByText(/is available\./)).toBeInTheDocument();
    });
    expect(window.localStorage.getItem('aya:conversation-id')).toBe('conv-1');
  });

  it('shows the safe error message sent by the stream', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = init?.method ?? 'GET';
      if (method === 'GET' && url.endsWith('/conversations')) return jsonResponse([]);
      if (method === 'POST' && url.endsWith('/agent/chat/stream')) {
        return sseResponse([
          sseEvent('conversation', { id: 'conv-2', title: 'Failing chat' }),
          sseEvent('error', { message: 'The AI provider returned an error (502).' }),
        ]);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderChat();

    await user.type(screen.getByLabelText('Message Aya'), 'Try again');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The AI provider returned an error (502).',
    );
  });

  it('falls back to the JSON response when streaming is unavailable', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = init?.method ?? 'GET';
      if (method === 'GET' && url.endsWith('/conversations')) return jsonResponse([]);
      if (method === 'POST' && url.endsWith('/agent/chat/stream')) {
        return jsonResponse({ conversationId: 'conv-3', content: 'JSON fallback works.' });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderChat();

    await user.type(screen.getByLabelText('Message Aya'), 'Fallback please');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByText('JSON fallback works.')).toBeInTheDocument();
  });
});
