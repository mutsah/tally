import { nestFetch } from '@/lib/api/nest-fetch';
import type { Category } from '@/lib/api/types';
import { CategoriesView } from '@/components/categories/categories-view';

// Server component: seeds the category list through the F1 session. SSR reads
// don't refresh cookies — the client query (via the BFF) handles a 401 refresh.
export default async function CategoriesPage() {
  const { status, data } = await nestFetch('/categories');
  const initialCategories = status === 200 ? (data as Category[]) : null;

  return <CategoriesView initialCategories={initialCategories} />;
}
