import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { callNestAuth, isAuthTokens } from '@/lib/auth/nest-auth';
import { COOKIE, setAuthCookies, clearAuthCookies } from '@/lib/auth/cookies';
import { enforceSameOrigin } from '@/lib/auth/same-origin';

export async function POST(req: Request) {
  const blocked = enforceSameOrigin(req);
  if (blocked) return blocked;

  const store = await cookies();
  const refresh = store.get(COOKIE.refresh)?.value;
  if (!refresh) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 });
  }

  // Nest reads the refresh token from the Authorization header (Bearer),
  // verifies it against the stored hash, and rotates both tokens.
  const { status, data } = await callNestAuth('/auth/refresh', {
    method: 'POST',
    headers: { Authorization: `Bearer ${refresh}` },
  });

  if (status === 200 && isAuthTokens(data)) {
    await setAuthCookies(data);
    return NextResponse.json({ ok: true });
  }

  await clearAuthCookies();
  return NextResponse.json({ error: 'refresh_failed' }, { status: 401 });
}
