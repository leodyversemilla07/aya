const DEFAULT_API_URL = 'http://localhost:3001';

export function getApiUrl(path: string): string {
  const base = (process.env.AYA_API_URL ?? process.env.API_URL ?? DEFAULT_API_URL).replace(
    /\/+$/,
    '',
  );
  return `${base}/${path.replace(/^\/+/, '')}`;
}

export function getApiHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);

  // The proxy is the only component allowed to supply the API key. Never
  // forward a browser-provided key, even when AYA_API_KEY is unset.
  headers.delete('x-api-key');

  const apiKey = process.env.AYA_API_KEY?.trim();
  if (apiKey) {
    headers.set('x-api-key', apiKey);
  }

  headers.set('accept', 'application/json');
  return headers;
}
