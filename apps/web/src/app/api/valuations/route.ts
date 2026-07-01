import { NextResponse } from 'next/server';
import { nestFetch } from '@/lib/api/nest-fetch';
import { enforceSameOrigin } from '@/lib/auth/same-origin';

// POST /api/valuations — record a valuation snapshot for a valued account
// (INVESTMENT / MICROLOANS). Same-origin only.
export async function POST(req: Request) {
  const blocked = enforceSameOrigin(req);
  if (blocked) return blocked;

  const body = await req.text();
  const { status, data } = await nestFetch(
    '/valuations',
    { method: 'POST', body },
    { allowRefresh: true },
  );
  return NextResponse.json(data, { status });
}
