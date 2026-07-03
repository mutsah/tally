import { NextResponse } from 'next/server';
import { nestFetch } from '@/lib/api/nest-fetch';
import { enforceSameOrigin } from '@/lib/auth/same-origin';

// PATCH /api/categories/:id — rename and/or re-parent. Same-origin only.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = enforceSameOrigin(req);
  if (blocked) return blocked;

  const { id } = await params;
  const body = await req.text();
  const { status, data } = await nestFetch(
    `/categories/${id}`,
    { method: 'PATCH', body },
    { allowRefresh: true },
  );
  return NextResponse.json(data, { status });
}

// DELETE /api/categories/:id — hard delete; the API blocks (409) a category that
// still has children. Same-origin only.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = enforceSameOrigin(req);
  if (blocked) return blocked;

  const { id } = await params;
  const { status, data } = await nestFetch(
    `/categories/${id}`,
    { method: 'DELETE' },
    { allowRefresh: true },
  );
  return NextResponse.json(data, { status });
}
