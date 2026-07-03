import { NextResponse } from 'next/server';
import { nestFetch } from '@/lib/api/nest-fetch';

// GET /api/categories — the signed-in user's categories (read-only for F3;
// used to populate the income/expense category selectors).
export async function GET() {
  const { status, data } = await nestFetch(
    '/categories',
    {},
    { allowRefresh: true },
  );
  return NextResponse.json(data, { status });
}
