import { cookies } from 'next/headers';
import { COOKIE, type SessionUser } from './cookies';

/**
 * Read the current session server-side (server components / route handlers).
 * The profile comes from the `tally_user` cookie — the backend has no /auth/me
 * endpoint, so the login/register response body is the source of user info.
 */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(COOKIE.user)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

/** The current access token (for forwarding to the Nest API in later phases). */
export async function getAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE.access)?.value ?? null;
}

export type { SessionUser };
