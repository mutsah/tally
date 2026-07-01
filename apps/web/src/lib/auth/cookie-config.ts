/**
 * Pure BFF cookie config — NO `next/headers` import, so it is safe from BOTH
 * server route handlers/components AND the Edge middleware. Single source of
 * truth for cookie names, attributes, and lifetimes: every place that writes an
 * auth cookie (login, register, refresh, and the middleware refresh re-set) uses
 * these, so httpOnly / SameSite=Lax / Secure-in-prod can never drift apart.
 */
export const COOKIE = {
  access: 'tally_access',
  refresh: 'tally_refresh',
  user: 'tally_user',
} as const;

export interface SessionUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

// httpOnly + SameSite=Lax always. Secure ONLY in production — so cookies still
// set over http://localhost in dev, and are Secure behind Caddy's TLS in prod.
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
} as const;

// Align cookie lifetimes with the backend token TTLs (access ~15m, refresh 7d).
export const ACCESS_MAX_AGE = 60 * 15;
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 7;
