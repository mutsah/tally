import { cookies } from 'next/headers';
import { COOKIE, setAuthCookies } from '@/lib/auth/cookies';
import { isAuthTokens } from '@/lib/auth/nest-auth';

/**
 * Server-side authenticated call to the Nest API (used by BFF data route
 * handlers and server components). Forwards the access token from the session
 * cookie — the browser never sends it. Money stays a string: responses are
 * returned as parsed JSON with no number coercion.
 *
 * On a 401, when `allowRefresh` is set (only safe in route handlers — a server
 * component render cannot write cookies), it rotates via the refresh cookie and
 * retries once. SSR reads pass `allowRefresh: false`.
 */
const API_BASE = process.env.API_BASE ?? 'http://localhost:3002/api/v1';

export interface NestResponse {
  status: number;
  data: unknown;
}

function call(
  path: string,
  init: RequestInit,
  accessToken: string | undefined,
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });
}

/**
 * Token-forwarded call returning the RAW Response (headers + body intact) — for
 * non-JSON payloads like the CSV export. Rotates once on a 401 when allowed.
 */
export async function nestFetchRaw(
  path: string,
  init: RequestInit = {},
  opts: { allowRefresh?: boolean } = {},
): Promise<Response> {
  const store = await cookies();
  const access = store.get(COOKIE.access)?.value;
  let res = await call(path, init, access);

  if (res.status === 401 && opts.allowRefresh) {
    const refresh = store.get(COOKIE.refresh)?.value;
    if (refresh) {
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${refresh}` },
        cache: 'no-store',
      });
      if (refreshRes.ok) {
        const tokens = await refreshRes.json();
        if (isAuthTokens(tokens)) {
          await setAuthCookies(tokens);
          res = await call(path, init, tokens.accessToken);
        }
      }
    }
  }

  return res;
}

export async function nestFetch(
  path: string,
  init: RequestInit = {},
  opts: { allowRefresh?: boolean } = {},
): Promise<NestResponse> {
  const res = await nestFetchRaw(path, init, opts);
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // empty / non-JSON body
  }
  return { status: res.status, data };
}
