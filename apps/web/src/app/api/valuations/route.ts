import { NextResponse } from 'next/server';
import { nestFetch } from '@/lib/api/nest-fetch';
import { enforceSameOrigin } from '@/lib/auth/same-origin';

// GET /api/valuations — the user's valuation snapshots (asOf desc). Read-only;
// query (e.g. accountId) forwarded. Used by the dashboard's valuation-status card.
export async function GET(req: Request) {
  const search = new URL(req.url).search;
  const { status, data } = await nestFetch(
    `/valuations${search}`,
    {},
    { allowRefresh: true },
  );
  return NextResponse.json(data, { status });
}

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
