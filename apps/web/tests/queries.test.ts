import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApiUrl } from '../lib/api';
import { conversationQuery, conversationsQuery, queryKeys, statsQuery } from '../lib/queries';

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

function restoreApiUrl(): void {
  if (originalApiUrl === undefined) {
    Reflect.deleteProperty(process.env, 'NEXT_PUBLIC_API_URL');
  } else {
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  }
}

afterEach(() => {
  restoreApiUrl();
  vi.unstubAllGlobals();
});

describe('getApiUrl', () => {
  it('joins the base URL and path', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/';

    expect(getApiUrl('/conversations')).toBe('https://api.example.com/conversations');
    expect(getApiUrl('conversations')).toBe('https://api.example.com/conversations');
  });

  it('falls back to the local API origin', () => {
    Reflect.deleteProperty(process.env, 'NEXT_PUBLIC_API_URL');

    expect(getApiUrl('/stats')).toBe('http://localhost:3001/stats');
  });
});

describe('query definitions', () => {
  it('uses stable keys scoped by conversation id', () => {
    expect(queryKeys.conversations).toEqual(['conversations']);
    expect(queryKeys.stats).toEqual(['dashboard', 'stats']);
    expect(queryKeys.conversation('abc')).toEqual(['conversation', 'abc']);
  });

  it('encodes conversation ids and forwards credentials', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: 'a b', title: 'Test', messages: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const controller = new AbortController();
    const result = await conversationQuery('a b').queryFn({ signal: controller.signal });

    expect(result.id).toBe('a b');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/conversations/a%20b',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        signal: controller.signal,
      }),
    );
  });

  it('surfaces API error messages', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: ['First', 'second'] }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    );

    await expect(statsQuery().queryFn({ signal: new AbortController().signal })).rejects.toThrow(
      'First second',
    );
  });

  it('falls back to a status message for non-JSON errors', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );

    await expect(
      conversationsQuery().queryFn({ signal: new AbortController().signal }),
    ).rejects.toThrow('Request failed (500).');
  });
});
