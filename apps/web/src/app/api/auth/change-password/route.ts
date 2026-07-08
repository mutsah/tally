import { NextResponse } from 'next/server';
import { nestFetch } from '@/lib/api/nest-fetch';
import { enforceSameOrigin } from '@/lib/auth/same-origin';

// POST /api/auth/change-password — authenticated self-service password change.
// Same-origin guarded (mutating), forwards the session access token to Nest, and
// relays the upstream status + body so the client can map 401 (wrong current /
// unauthenticated) and 400 (weak or duplicate new password). Passwords are only
// passed through — never logged.
export async function POST(req: Request) {
  const blocked = enforceSameOrigin(req);
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { message: 'Invalid request body' },
      { status: 400 },
    );
  }

  const { currentPassword, newPassword } = (body ?? {}) as {
    currentPassword?: unknown;
    newPassword?: unknown;
  };
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return NextResponse.json(
      { message: 'Invalid request body' },
      { status: 400 },
    );
  }

  const { status, data } = await nestFetch(
    '/auth/change-password',
    { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) },
    { allowRefresh: true },
  );

  return NextResponse.json(data ?? {}, { status });
}
