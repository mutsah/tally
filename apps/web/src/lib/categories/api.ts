import type { Category } from '@/lib/api/types';
import { parseJson } from '@/lib/api/http';

/** The signed-in user's categories (parent-then-children order), via the BFF. */
export function fetchCategories(): Promise<Category[]> {
  return fetch('/api/categories', { cache: 'no-store' }).then(
    parseJson<Category[]>,
  );
}
