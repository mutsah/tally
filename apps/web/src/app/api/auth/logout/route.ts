import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { callNestAuth } from '@/lib/auth/nest-auth';
import { COOKIE, clearAuthCookies } from '@/lib/auth/cookies';
import { enforceSameOrigin } from '@/lib/auth/same-origin';

export async function POST(req: Request) {
  const blocked = enforceSameOrigin(req);
  if (blocked) return blocked;

  const store = await cookies();
  const access = store.get(COOKIE.access)?.value;

  // Best-effort revoke of the refresh token server-side; always clear locally.
  if (access) {
    await callNestAuth('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}` },
    }).catch(() => undefined);
  }

  await clearAuthCookies();
  return NextResponse.json({ ok: true });
}
