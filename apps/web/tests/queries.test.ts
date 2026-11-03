import assert from 'node:assert/strict';
import test from 'node:test';
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

test('getApiUrl joins the base URL and path', () => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/';
  try {
    assert.equal(getApiUrl('/conversations'), 'https://api.example.com/conversations');
    assert.equal(getApiUrl('conversations'), 'https://api.example.com/conversations');
  } finally {
    restoreApiUrl();
  }
});

test('getApiUrl falls back to the local API origin', () => {
  Reflect.deleteProperty(process.env, 'NEXT_PUBLIC_API_URL');
  try {
    assert.equal(getApiUrl('/stats'), 'http://localhost:3001/stats');
  } finally {
    restoreApiUrl();
  }
});

test('query keys are stable and scoped by conversation id', () => {
  assert.deepEqual(queryKeys.conversations, ['conversations']);
  assert.deepEqual(queryKeys.stats, ['dashboard', 'stats']);
  assert.deepEqual(queryKeys.conversation('abc'), ['conversation', 'abc']);
});

test('conversationQuery encodes ids and forwards credentials', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
  const originalFetch = globalThis.fetch;
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = input.toString();
    capturedInit = init;
    return new Response(JSON.stringify({ id: 'a b', title: 'Test', messages: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const controller = new AbortController();
    const result = await conversationQuery('a b').queryFn({ signal: controller.signal });

    assert.equal(result.id, 'a b');
    assert.equal(capturedUrl, 'https://api.example.com/conversations/a%20b');
    assert.equal(capturedInit?.cache, 'no-store');
    assert.equal(capturedInit?.credentials, 'include');
    assert.equal(capturedInit?.signal, controller.signal);
  } finally {
    globalThis.fetch = originalFetch;
    restoreApiUrl();
  }
});

test('query functions surface API error messages', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ message: ['First', 'second'] }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;

  try {
    await assert.rejects(
      statsQuery().queryFn({ signal: new AbortController().signal }),
      /First second/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreApiUrl();
  }
});

test('query functions fall back to a status message for non-JSON errors', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('nope', { status: 500 })) as typeof fetch;

  try {
    await assert.rejects(
      conversationsQuery().queryFn({ signal: new AbortController().signal }),
      /Request failed \(500\)\./,
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreApiUrl();
  }
});
