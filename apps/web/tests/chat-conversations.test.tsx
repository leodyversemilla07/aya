import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatMessages } from '../components/chat/chat-messages';
import { ChatProvider } from '../components/chat/chat-provider';
import { jsonResponse, renderWithQueryClient } from './test-utils';

describe('conversation history', () => {
  beforeEach(() => {
    window.localStorage.setItem('aya:conversation-id', 'conv-1');
  });

  it('loads earlier messages with the cursor and hides the control when done', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.endsWith('/conversations')) return jsonResponse([]);
      if (url.includes('/conversations/conv-1?limit=50&before=msg-2')) {
        return jsonResponse({
          id: 'conv-1',
          title: 'History',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          messages: [
            {
              id: 'msg-1',
              role: 'user',
              content: 'Earlier question',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          hasMore: false,
          nextCursor: null,
        });
      }
      if (url.includes('/conversations/conv-1?limit=50')) {
        return jsonResponse({
          id: 'conv-1',
          title: 'History',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          messages: [
            {
              id: 'msg-2',
              role: 'assistant',
              content: 'Recent answer',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          hasMore: true,
          nextCursor: 'msg-2',
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithQueryClient(
      <ChatProvider>
        <ChatMessages />
      </ChatProvider>,
    );

    expect(await screen.findByText('Recent answer')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load earlier messages' }));

    expect(await screen.findByText('Earlier question')).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Load earlier messages' }),
      ).not.toBeInTheDocument();
    });
  });
});
