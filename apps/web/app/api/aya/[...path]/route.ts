import { Buffer } from 'node:buffer';
import { getApiHeaders, getApiUrl } from '@/lib/api';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BODY_BYTES = 64 * 1024;
const PROXY_TIMEOUT_MS = 120_000;

const HOP_BY_HOP_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
];

const ALLOWED_ROUTES: ReadonlyArray<{
  methods: readonly string[];
  pattern: RegExp;
}> = [
  { methods: ['GET', 'HEAD'], pattern: /^\/stats$/ },
  { methods: ['GET', 'HEAD'], pattern: /^\/conversations$/ },
  { methods: ['GET', 'HEAD'], pattern: /^\/conversations\/[^/]+$/ },
  { methods: ['DELETE'], pattern: /^\/conversations\/[^/]+$/ },
  { methods: ['POST'], pattern: /^\/agent\/chat$/ },
];

class ProxyRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ProxyRequestError';
  }
}

function validateRoute(method: string, path: string): void {
  const allowed = ALLOWED_ROUTES.some(
    (route) => route.methods.includes(method) && route.pattern.test(path),
  );
  if (!allowed) {
    throw new ProxyRequestError('This API route is not exposed through the web proxy.', 404);
  }
}

function normalizeOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value.trim().replace(/\/+$/, '');
  }
}

function getAllowedOrigins(request: NextRequest): Set<string> {
  const configuredOrigins = (process.env.AYA_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);
  const allowedOrigins = new Set([request.nextUrl.origin, ...configuredOrigins]);
  const host = request.headers.get('host');
  if (host) {
    const protocol = request.nextUrl.protocol.replace(/:$/, '');
    allowedOrigins.add(`${protocol}://${host}`);
  }
  return allowedOrigins;
}

function validateRequestOrigin(request: NextRequest): void {
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new ProxyRequestError('Cross-site requests are not allowed.', 403);
  }

  if (request.method === 'GET' || request.method === 'HEAD') {
    return;
  }

  const origin = request.headers.get('origin');
  if (!origin || !getAllowedOrigins(request).has(origin)) {
    throw new ProxyRequestError('The request origin is not allowed.', 403);
  }
}

function validateContentType(request: NextRequest): void {
  if (request.method !== 'POST') {
    return;
  }

  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  const mediaType = contentType.split(';', 1)[0]?.trim();
  if (mediaType !== 'application/json') {
    throw new ProxyRequestError('POST requests must use application/json.', 415);
  }
}

async function readRequestBody(request: NextRequest): Promise<ArrayBuffer | undefined> {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'DELETE') {
    return undefined;
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new ProxyRequestError('The request body is too large.', 413);
  }

  if (!request.body) {
    return new ArrayBuffer(0);
  }

  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new ProxyRequestError('The request body is too large.', 413);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  const body = Buffer.concat(chunks, totalBytes);
  // Copy from the Buffer's view so pooled allocations do not leak unrelated
  // bytes from the shared Buffer pool into the upstream request.
  return new Uint8Array(body).buffer;
}

function encodePath(path: string[]): string {
  if (path.length === 0) {
    throw new ProxyRequestError('An API path is required.', 404);
  }

  for (const segment of path) {
    if (!segment || segment === '.' || segment === '..' || segment.includes('\\')) {
      throw new ProxyRequestError('The API path is invalid.', 400);
    }
  }

  return path.map((segment) => encodeURIComponent(segment)).join('/');
}

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await context.params;

  try {
    const encodedPath = encodePath(path);
    validateRoute(request.method, `/${encodedPath}`);
    validateRequestOrigin(request);
    validateContentType(request);
    const body = await readRequestBody(request);

    const headers = getApiHeaders(request.headers);
    for (const header of HOP_BY_HOP_HEADERS) {
      headers.delete(header);
    }
    headers.delete('host');
    headers.delete('content-length');
    headers.delete('cookie');
    headers.delete('authorization');
    headers.set('accept-encoding', 'identity');

    const timeoutSignal = AbortSignal.timeout(PROXY_TIMEOUT_MS);
    const requestSignal = AbortSignal.any([request.signal, timeoutSignal]);
    const target = new URL(getApiUrl(encodedPath));
    target.search = request.nextUrl.search;

    const response = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
      signal: requestSignal,
    });

    const responseHeaders = new Headers(response.headers);
    for (const header of HOP_BY_HOP_HEADERS) {
      responseHeaders.delete(header);
    }
    for (const header of [
      'access-control-allow-origin',
      'access-control-allow-credentials',
      'access-control-allow-methods',
      'access-control-allow-headers',
      'access-control-expose-headers',
      'content-length',
      'location',
      'set-cookie',
    ]) {
      responseHeaders.delete(header);
    }
    responseHeaders.set('cache-control', 'no-store');

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    if (error instanceof ProxyRequestError) {
      return NextResponse.json(
        { statusCode: error.status, message: error.message },
        { status: error.status },
      );
    }

    if (request.signal.aborted) {
      return NextResponse.json(
        { statusCode: 499, message: 'The request was cancelled.' },
        { status: 499 },
      );
    }

    console.error('Aya API proxy request failed:', error);
    return NextResponse.json(
      {
        statusCode: 502,
        message: 'Aya API is unavailable. Make sure the API server is running.',
      },
      { status: 502 },
    );
  }
}

export { proxy as DELETE, proxy as GET, proxy as HEAD, proxy as POST };
