import type {
  Category,
  CategoryPatch,
  NewCategory,
} from '@/lib/api/types';
import { jsonInit, parseJson } from '@/lib/api/http';

/**
 * Client-side categories API — calls the same-origin BFF, which forwards the
 * session token to Nest. (No money here.)
 */

/** The signed-in user's categories (parent-then-children order), via the BFF. */
export function fetchCategories(): Promise<Category[]> {
  return fetch('/api/categories', { cache: 'no-store' }).then(
    parseJson<Category[]>,
  );
}

export function createCategory(input: NewCategory): Promise<Category> {
  return fetch('/api/categories', jsonInit('POST', input)).then(
    parseJson<Category>,
  );
}

export function updateCategory(
  id: string,
  patch: CategoryPatch,
): Promise<Category> {
  return fetch(`/api/categories/${id}`, jsonInit('PATCH', patch)).then(
    parseJson<Category>,
  );
}

export function deleteCategory(id: string): Promise<Category> {
  return fetch(`/api/categories/${id}`, { method: 'DELETE' }).then(
    parseJson<Category>,
  );
}
