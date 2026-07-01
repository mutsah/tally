/**
 * Typed API client seed (F0). A single `API_BASE` env is the only switchable
 * endpoint config. Runs server-side under the BFF pattern (route handlers /
 * server components proxy the Nest API); auth/cookie forwarding arrives in F1.
 *
 * Money-as-string guarantee: responses are returned via `res.json()`, which
 * keeps JSON strings as strings. This client NEVER parses money to a float.
 */
const API_BASE = process.env.API_BASE ?? 'http://localhost:3002/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, headers, ...rest } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new ApiError(res.status, `API ${res.status} for ${path}`);
  }

  // No number coercion — money fields stay strings, exactly as sent.
  return (await res.json()) as T;
}
