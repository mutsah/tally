import { NextResponse, type NextRequest } from 'next/server';
import {
  ACCESS_MAX_AGE,
  AUTH_COOKIE_OPTIONS,
  COOKIE,
  REFRESH_MAX_AGE,
} from '@/lib/auth/cookie-config';

// (app) URLs — require a session. (auth) URLs — bounce to /dashboard if signed in.
const PROTECTED = [
  '/dashboard',
  '/accounts',
  '/transactions',
  '/categories',
  '/budgets',
  '/settings',
];
const AUTH = ['/login', '/register'];

const API_BASE = process.env.API_BASE ?? 'http://localhost:3002/api/v1';

/** Best-effort expiry check (no signature verification — Nest enforces that). */
function isExpired(token: string | undefined): boolean {
  if (!token) return true;
  try {
    const payload = token.split('.')[1];
    const json = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/')),
    ) as { exp?: number };
    return typeof json.exp !== 'number' || json.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Expire all three auth cookies on a response (matching set attributes/path). */
function clearAuthCookies(res: NextResponse): void {
  for (const name of Object.values(COOKIE)) {
    res.cookies.set(name, '', { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
  }
}

function redirectTo(
  req: NextRequest,
  path: string,
  clear = false,
): NextResponse {
  const res = NextResponse.redirect(new URL(path, req.url));
  if (clear) clearAuthCookies(res);
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = matches(pathname, PROTECTED);
  const isAuth = matches(pathname, AUTH);
  if (!isProtected && !isAuth) return NextResponse.next();

  const access = req.cookies.get(COOKIE.access)?.value;
  const refresh = req.cookies.get(COOKIE.refresh)?.value;
  const hasSession = Boolean(refresh);

  if (isAuth) {
    return hasSession ? redirectTo(req, '/dashboard') : NextResponse.next();
  }

  // Protected route from here on.
  if (!hasSession) {
    // No refresh token → not signed in; drop any stale access/user cookies too.
    return redirectTo(req, '/login', true);
  }
  if (!isExpired(access)) {
    return NextResponse.next();
  }

  // Access token expired but a refresh token is present → rotate via Nest.
  // Any failure (expired/revoked refresh, Nest 401, or Nest unreachable) clears
  // the cookies and lands on /login — never throws, 500s, or loops.
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${refresh}` },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
    const tokens = (await res.json()) as {
      accessToken: string;
      refreshToken: string;
      user: unknown;
    };
    const next = NextResponse.next();
    next.cookies.set(COOKIE.access, tokens.accessToken, {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: ACCESS_MAX_AGE,
    });
    next.cookies.set(COOKIE.refresh, tokens.refreshToken, {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: REFRESH_MAX_AGE,
    });
    next.cookies.set(COOKIE.user, JSON.stringify(tokens.user), {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: REFRESH_MAX_AGE,
    });
    return next;
  } catch {
    return redirectTo(req, '/login', true);
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
