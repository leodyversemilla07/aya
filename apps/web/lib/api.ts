export function getApiUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/+$/, '');
  return `${base}/${path.replace(/^\/+/, '')}`;
}

type QueryValue = string | number | boolean | null | undefined;

/** Builds a query string, omitting empty values so defaults apply server-side. */
export function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

async function errorMessage(response: Response): Promise<string> {
  let message = `Request failed (${response.status}).`;
  try {
    const data = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(data.message)) message = data.message.join(' ');
    else if (typeof data.message === 'string' && data.message.trim()) message = data.message;
  } catch {
    // Fall back to the status-based message when the body is not JSON.
  }
  return message;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;
  const response = await fetch(getApiUrl(path), {
    method,
    cache: 'no-store',
    credentials: 'include',
    signal,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) throw new Error(await errorMessage(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
