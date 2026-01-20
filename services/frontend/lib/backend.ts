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
