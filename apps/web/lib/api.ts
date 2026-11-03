export function getApiUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/+$/, '');
  return `${base}/${path.replace(/^\/+/, '')}`;
}
