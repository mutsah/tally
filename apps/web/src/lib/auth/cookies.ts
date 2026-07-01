import { cookies } from 'next/headers';
import {
  ACCESS_MAX_AGE,
  AUTH_COOKIE_OPTIONS,
  COOKIE,
  REFRESH_MAX_AGE,
  type SessionUser,
} from './cookie-config';

/**
 * Server-side (route handlers / server components) cookie writers. The browser
 * NEVER receives the raw JWTs as readable values — they live in httpOnly,
 * SameSite=Lax cookies (Secure in production). Cookie names/attributes/lifetimes
 * come from ./cookie-config, shared with the Edge middleware.
 */
export { COOKIE, type SessionUser };

export async function setAuthCookies(tokens: {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}): Promise<void> {
  const store = await cookies();
  store.set(COOKIE.access, tokens.accessToken, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: ACCESS_MAX_AGE,
  });
  store.set(COOKIE.refresh, tokens.refreshToken, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: REFRESH_MAX_AGE,
  });
  store.set(COOKIE.user, JSON.stringify(tokens.user), {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: REFRESH_MAX_AGE,
  });
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  for (const name of Object.values(COOKIE)) {
    store.set(name, '', { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
  }
}
