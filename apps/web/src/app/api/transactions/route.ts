import { NextResponse } from 'next/server';
import { nestFetch } from '@/lib/api/nest-fetch';
import { enforceSameOrigin } from '@/lib/auth/same-origin';

// GET /api/transactions — the signed-in user's transactions (filtered, paged).
// Query params (accountId, categoryId, from, to, page, pageSize) pass straight
// through to Nest.
export async function GET(req: Request) {
  const search = new URL(req.url).search;
  const { status, data } = await nestFetch(
    `/transactions${search}`,
    {},
    { allowRefresh: true },
  );
  return NextResponse.json(data, { status });
}

// POST /api/transactions — create income / expense / transfer. Same-origin only.
export async function POST(req: Request) {
  const blocked = enforceSameOrigin(req);
  if (blocked) return blocked;

  const body = await req.text();
  const { status, data } = await nestFetch(
    '/transactions',
    { method: 'POST', body },
    { allowRefresh: true },
  );
  return NextResponse.json(data, { status });
}
