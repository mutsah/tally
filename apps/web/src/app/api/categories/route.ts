import { NextResponse } from 'next/server';
import { nestFetch } from '@/lib/api/nest-fetch';
import { enforceSameOrigin } from '@/lib/auth/same-origin';

// GET /api/categories — the signed-in user's categories (flat, parent-then-child).
export async function GET() {
  const { status, data } = await nestFetch(
    '/categories',
    {},
    { allowRefresh: true },
  );
  return NextResponse.json(data, { status });
}

// POST /api/categories — create a category. Same-origin only.
export async function POST(req: Request) {
  const blocked = enforceSameOrigin(req);
  if (blocked) return blocked;

  const body = await req.text();
  const { status, data } = await nestFetch(
    '/categories',
    { method: 'POST', body },
    { allowRefresh: true },
  );
  return NextResponse.json(data, { status });
}
