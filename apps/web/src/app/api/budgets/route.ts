import { NextResponse } from 'next/server';
import { nestFetch } from '@/lib/api/nest-fetch';
import { enforceSameOrigin } from '@/lib/auth/same-origin';

// GET /api/budgets — the signed-in user's budgets (amount as a string).
export async function GET() {
  const { status, data } = await nestFetch('/budgets', {}, { allowRefresh: true });
  return NextResponse.json(data, { status });
}

// POST /api/budgets — set a monthly limit for a category. Same-origin only.
// The API rejects a non-expense category and a category already budgeted (409).
export async function POST(req: Request) {
  const blocked = enforceSameOrigin(req);
  if (blocked) return blocked;

  const body = await req.text();
  const { status, data } = await nestFetch(
    '/budgets',
    { method: 'POST', body },
    { allowRefresh: true },
  );
  return NextResponse.json(data, { status });
}
