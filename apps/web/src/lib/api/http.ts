/**
 * Small shared helpers for the client-side BFF calls. Money stays a string end
 * to end — responses are parsed as JSON with no number coercion.
 */
export class ApiError extends Error {
  constructor(public readonly status: number) {
    super(`request failed: ${status}`);
    this.name = 'ApiError';
  }
}

export async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new ApiError(res.status);
  return res.json() as Promise<T>;
}

export function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
