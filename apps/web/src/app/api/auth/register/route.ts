import { NextResponse } from 'next/server';
import { callNestAuth, isAuthTokens } from '@/lib/auth/nest-auth';
import { setAuthCookies } from '@/lib/auth/cookies';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
  };

  const { status, data } = await callNestAuth('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: body.email,
      password: body.password,
      firstName: body.firstName || undefined,
      lastName: body.lastName || undefined,
    }),
  });

  // Register returns 201 + tokens; the user is signed in immediately.
  if (status === 201 && isAuthTokens(data)) {
    await setAuthCookies(data);
    return NextResponse.json({ user: data.user }, { status: 201 });
  }

  return NextResponse.json(
    { error: 'register_failed' },
    {
      status: status === 409 || status === 400 || status === 429 ? status : 502,
    },
  );
}
