import { NextResponse } from 'next/server';
import { nestFetchRaw } from '@/lib/api/nest-fetch';
import { enforceSameOrigin } from '@/lib/auth/same-origin';

// GET /api/transactions/export — proxy the CSV export. Forwards the session token
// and the filter query (accountId, categoryId, kind, from, to) to Nest, and
// passes the CSV body + its Content-Type/Content-Disposition straight back so the
// browser saves a properly-named file. Same-origin guarded like the other BFF
// routes (the browser triggers this from the app).
export async function GET(req: Request) {
  const blocked = enforceSameOrigin(req);
  if (blocked) return blocked;

  const search = new URL(req.url).search;
  const res = await nestFetchRaw(
    `/transactions/export${search}`,
    {},
    { allowRefresh: true },
  );

  if (!res.ok) {
    return NextResponse.json({ error: 'export_failed' }, { status: res.status });
  }

  const body = await res.text();
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type':
        res.headers.get('Content-Type') ?? 'text/csv; charset=utf-8',
      'Content-Disposition':
        res.headers.get('Content-Disposition') ??
        `attachment; filename="tally-transactions-${today}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
