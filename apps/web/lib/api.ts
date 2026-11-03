import { getWebEnv } from '@workspace/env';

const DEFAULT_API_URL = 'http://localhost:3001';
export function getApiUrl(path: string): string {
  const base = (getWebEnv().AYA_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, '');
  return `${base}/${path.replace(/^\/+/, '')}`;
}

export function getApiHeaders(init?: HeadersInit): Headers {
  const incoming = new Headers(init);
  const headers = new Headers({ accept: 'application/json' });

  // Build a minimal upstream header set instead of relaying arbitrary browser
  // headers (for example, spoofed forwarding or tracing headers).
  const contentType = incoming.get('content-type');
  if (contentType) {
    headers.set('content-type', contentType);
  }

  // The proxy is the only component allowed to supply the API key. Never
  // forward a browser-provided key, even when AYA_API_KEY is unset.
  const apiKey = getWebEnv().AYA_API_KEY;
  if (apiKey) {
    headers.set('x-api-key', apiKey);
  }

  const cookie = incoming.get('cookie');
  if (cookie) {
    const sessionCookies = cookie
      .split(';')
      .map((part) => part.trim())
      .filter(
        (part) =>
          part.startsWith('better-auth.session_token=') ||
          part.startsWith('__Secure-better-auth.session_token='),
      );
    if (sessionCookies.length > 0) headers.set('cookie', sessionCookies.join('; '));
  }

  return headers;
}
