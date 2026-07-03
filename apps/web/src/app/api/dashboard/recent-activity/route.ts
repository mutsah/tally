import { NextResponse } from 'next/server';
import { nestFetch } from '@/lib/api/nest-fetch';

// GET /api/dashboard/recent-activity?limit — read-only; query forwarded.
export async function GET(req: Request) {
  const search = new URL(req.url).search;
  const { status, data } = await nestFetch(
    `/dashboard/recent-activity${search}`,
    {},
    { allowRefresh: true },
  );
  return NextResponse.json(data, { status });
}
