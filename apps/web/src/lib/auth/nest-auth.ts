import type { SessionUser } from './cookies';

/**
 * Server-side caller for the Nest auth endpoints (used only by the BFF route
 * handlers). Returns the raw upstream status so handlers can map it to a
 * friendly, first-party message — raw API errors are never surfaced to the UI.
 */
const API_BASE = process.env.API_BASE ?? 'http://localhost:3002/api/v1';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

export interface NestResult {
  status: number;
  data: unknown;
}

export async function callNestAuth(
  path: string,
  init: RequestInit = {},
): Promise<NestResult> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // empty / non-JSON body
  }
  return { status: res.status, data };
}

export function isAuthTokens(data: unknown): data is AuthTokens {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as AuthTokens).accessToken === 'string' &&
    typeof (data as AuthTokens).refreshToken === 'string'
  );
}
