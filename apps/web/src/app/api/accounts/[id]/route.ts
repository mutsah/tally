import { NextResponse } from 'next/server';
import { nestFetch } from '@/lib/api/nest-fetch';
import { enforceSameOrigin } from '@/lib/auth/same-origin';

// PATCH /api/accounts/:id — rename or archive/unarchive. Same-origin only.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = enforceSameOrigin(req);
  if (blocked) return blocked;

  const { id } = await params;
  const body = await req.text();
  const { status, data } = await nestFetch(
    `/accounts/${id}`,
    { method: 'PATCH', body },
    { allowRefresh: true },
  );
  return NextResponse.json(data, { status });
}
