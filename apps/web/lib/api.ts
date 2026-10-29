const DEFAULT_API_URL = 'http://localhost:3001';

export function getApiUrl(path: string): string {
  const base = (process.env.AYA_API_URL ?? process.env.API_URL ?? DEFAULT_API_URL).replace(
    /\/+$/,
    '',
  );
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
  const apiKey = process.env.AYA_API_KEY?.trim();
  if (apiKey) {
    headers.set('x-api-key', apiKey);
  }

  return headers;
}
