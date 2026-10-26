import { getApiHeaders, getApiUrl } from '@/lib/api';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await context.params;

  const headers = getApiHeaders(request.headers);
  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header);
  }
  headers.delete('host');
  headers.delete('content-length');
  headers.delete('cookie');
  headers.delete('authorization');
  headers.set('accept-encoding', 'identity');

  const body =
    request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();

  try {
    const target = new URL(getApiUrl(path.join('/')));
    target.search = request.nextUrl.search;

    const response = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(120_000),
    });

    const responseHeaders = new Headers(response.headers);
    for (const header of HOP_BY_HOP_HEADERS) {
      responseHeaders.delete(header);
    }
    responseHeaders.delete('content-length');

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
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

export {
  proxy as DELETE,
  proxy as GET,
  proxy as HEAD,
  proxy as PATCH,
  proxy as POST,
  proxy as PUT,
};
