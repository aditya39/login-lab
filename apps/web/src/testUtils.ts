import { vi } from 'vitest';

export function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>;

/** Stubs global fetch, routing by "METHOD path". */
export function mockFetch(routes: Record<string, FetchHandler>) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const key = `${init?.method ?? 'GET'} ${url}`;
    const handler = routes[key];
    if (!handler) throw new Error(`Unexpected fetch: ${key}`);
    return handler(url, init);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
