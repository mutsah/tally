/**
 * Small shared helpers for the client-side BFF calls. Money stays a string end
 * to end — responses are parsed as JSON with no number coercion.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message?: string,
  ) {
    super(message ?? `request failed: ${status}`);
    this.name = 'ApiError';
  }
}

/** Pull Nest's `{ message }` (string or string[]) off an error response body. */
async function errorMessage(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as { message?: unknown };
    if (typeof body.message === 'string') return body.message;
    if (Array.isArray(body.message)) return body.message.join(', ');
  } catch {
    // no / non-JSON body
  }
  return undefined;
}

export async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new ApiError(res.status, await errorMessage(res));
  }
  return res.json() as Promise<T>;
}

export function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
