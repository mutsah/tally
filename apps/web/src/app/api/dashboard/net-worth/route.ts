import { NextResponse } from 'next/server';
import { nestFetch } from '@/lib/api/nest-fetch';

// GET /api/dashboard/net-worth — total + per-account breakdown (read-only).
export async function GET() {
  const { status, data } = await nestFetch(
    '/dashboard/net-worth',
    {},
    { allowRefresh: true },
  );
  return NextResponse.json(data, { status });
}
