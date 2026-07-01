import { NextResponse } from 'next/server';
import { nestFetch } from '@/lib/api/nest-fetch';
import { enforceSameOrigin } from '@/lib/auth/same-origin';

// GET /api/accounts — list the signed-in user's accounts (with balances).
export async function GET() {
  const { status, data } = await nestFetch('/accounts', {}, { allowRefresh: true });
  return NextResponse.json(data, { status });
}

// POST /api/accounts — create an account. Same-origin only.
export async function POST(req: Request) {
  const blocked = enforceSameOrigin(req);
  if (blocked) return blocked;

  const body = await req.text();
  const { status, data } = await nestFetch(
    '/accounts',
    { method: 'POST', body },
    { allowRefresh: true },
  );
  return NextResponse.json(data, { status });
}
