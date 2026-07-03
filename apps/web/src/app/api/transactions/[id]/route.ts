import { NextResponse } from 'next/server';
import { nestFetch } from '@/lib/api/nest-fetch';
import { enforceSameOrigin } from '@/lib/auth/same-origin';

// PATCH /api/transactions/:id — edit a transaction. Same-origin only.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = enforceSameOrigin(req);
  if (blocked) return blocked;

  const { id } = await params;
  const body = await req.text();
  const { status, data } = await nestFetch(
    `/transactions/${id}`,
    { method: 'PATCH', body },
    { allowRefresh: true },
  );
  return NextResponse.json(data, { status });
}

// DELETE /api/transactions/:id — hard delete. Same-origin only.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = enforceSameOrigin(req);
  if (blocked) return blocked;

  const { id } = await params;
  const { status, data } = await nestFetch(
    `/transactions/${id}`,
    { method: 'DELETE' },
    { allowRefresh: true },
  );
  return NextResponse.json(data, { status });
}
