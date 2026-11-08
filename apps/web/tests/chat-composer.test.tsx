import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChatComposer } from '../components/chat/chat-composer';
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
});
