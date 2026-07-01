import { NextResponse } from 'next/server';
import { callNestAuth, isAuthTokens } from '@/lib/auth/nest-auth';
import { setAuthCookies } from '@/lib/auth/cookies';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };

  const { status, data } = await callNestAuth('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: body.email, password: body.password }),
  });

  if (status === 200 && isAuthTokens(data)) {
    await setAuthCookies(data);
    return NextResponse.json({ user: data.user });
  }

  // Surface only the status; the client renders first-party copy.
  return NextResponse.json(
    { error: 'login_failed' },
    { status: status === 401 || status === 429 ? status : 502 },
  );
}
