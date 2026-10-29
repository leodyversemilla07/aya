import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { DELETE, GET, POST } from '../app/api/aya/[...path]/route';

function context(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

test('rejects cross-origin state-changing requests', async () => {
  const request = new NextRequest('http://localhost:3000/api/aya/agent/chat', {
    method: 'POST',
    headers: {
      origin: 'https://evil.example',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'message=external request',
  });

  const response = await POST(request, context(['agent', 'chat']));
  assert.equal(response.status, 403);
});

test('requires an origin for state-changing requests', async () => {
  const request = new NextRequest('http://localhost:3000/api/aya/agent/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'hello' }),
  });

  const response = await POST(request, context(['agent', 'chat']));
  assert.equal(response.status, 403);
});

test('rejects browser cross-site reads', async () => {
  const request = new NextRequest('http://localhost:3000/api/aya/stats', {
    method: 'GET',
    headers: { 'sec-fetch-site': 'cross-site' },
  });

  const response = await GET(request, context(['stats']));
  assert.equal(response.status, 403);
});

test('only exposes known API routes', async () => {
  const request = new NextRequest('http://localhost:3000/api/aya/unknown', {
    method: 'GET',
  });

  const response = await GET(request, context(['unknown']));
  assert.equal(response.status, 404);
});

test('requires JSON for chat requests', async () => {
  const request = new NextRequest('http://localhost:3000/api/aya/agent/chat', {
    method: 'POST',
    headers: {
      origin: 'http://localhost:3000',
      'content-type': 'text/plain',
    },
    body: 'hello',
  });

  const response = await POST(request, context(['agent', 'chat']));
  assert.equal(response.status, 415);
});

test('rejects JSON-like but invalid content types', async () => {
  const request = new NextRequest('http://localhost:3000/api/aya/agent/chat', {
    method: 'POST',
    headers: {
      origin: 'http://localhost:3000',
      'content-type': 'application/jsonp',
    },
    body: JSON.stringify({ message: 'hello' }),
  });

  const response = await POST(request, context(['agent', 'chat']));
  assert.equal(response.status, 415);
});

test('rejects oversized bodies before forwarding them', async () => {
  const request = new NextRequest('http://localhost:3000/api/aya/agent/chat', {
    method: 'POST',
    headers: {
      origin: 'http://localhost:3000',
      'content-type': 'application/json',
      'content-length': String(70 * 1024),
    },
    body: '{}',
  });

  const response = await POST(request, context(['agent', 'chat']));
  assert.equal(response.status, 413);
});

test('forwards allowed same-origin requests with the server API key', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.AYA_API_KEY;
  process.env.AYA_API_KEY = 'server-api-key';

  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  globalThis.fetch = async (input, init) => {
    capturedUrl = input.toString();
    capturedInit = init;
    return new Response(JSON.stringify({ conversationId: 'test', content: 'ok' }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
      },
    });
  };

  try {
    const request = new NextRequest('http://localhost:3000/api/aya/agent/chat', {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json',
        authorization: 'Bearer browser-token',
        'x-forwarded-for': '203.0.113.10',
      },
      body: JSON.stringify({ message: 'hello' }),
    });

    const response = await POST(request, context(['agent', 'chat']));
    assert.equal(response.status, 200);
    assert.equal(new URL(capturedUrl).pathname, '/agent/chat');
    assert.equal(
      new TextDecoder().decode(capturedInit?.body as ArrayBuffer),
      '{"message":"hello"}',
    );

    const headers = new Headers(capturedInit?.headers);
    assert.equal(headers.get('x-api-key'), 'server-api-key');
    assert.equal(headers.get('authorization'), null);
    assert.equal(headers.get('x-forwarded-for'), null);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      Reflect.deleteProperty(process.env, 'AYA_API_KEY');
    } else {
      process.env.AYA_API_KEY = originalApiKey;
    }
  }
});

test('requires an origin for conversation deletion', async () => {
  const request = new NextRequest('http://localhost:3000/api/aya/conversations/example', {
    method: 'DELETE',
  });

  const response = await DELETE(request, context(['conversations', 'example']));
  assert.equal(response.status, 403);
});
