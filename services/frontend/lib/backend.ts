export function backendBaseUrl(): string {
  // When running in Docker Compose, this should be set to http://backend:3000.
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
}

export async function backendFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = new URL(path, backendBaseUrl());
  return fetch(url, {
    // Always bypass cache for MVP to reflect edits immediately.
    cache: 'no-store',
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

/**
 * Fetches an API path in a way that works in both server and browser contexts.
 *
 * - Server: calls the backend directly via NEXT_PUBLIC_API_BASE_URL (docker: http://backend:3000)
 * - Browser: calls the Next.js `/api/*` rewrite (host-relative)
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  if (typeof window !== 'undefined') {
    return fetch(path, {
      cache: 'no-store',
      ...init,
    });
  }

  // Server-side: keep existing behavior.
  return backendFetch(path, init);
}

export async function apiFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }

  return (await res.json()) as T;
}
