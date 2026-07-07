import type { Category } from '@/lib/api/types';
import { toCsv } from '@/lib/csv/to-csv';

/**
 * Build the Categories CSV (client-side — GET /categories returns the full flat
 * list, no pagination). One row per category (parents and children alike).
 * Columns: name, kind, parent.
 *   - `kind` is emitted straight from the field (INCOME/EXPENSE today), so any
 *     future kind passes through without a hardcoded whitelist.
 *   - `parent` is the parent category's readable NAME (resolved from parentId via
 *     an id→name map over the full list), empty for a top-level category — never
 *     a raw UUID, since this opens in a spreadsheet.
 * (Categories carry no archived/money fields, so neither is emitted.)
 */
export function buildCategoriesCsv(categories: Category[]): {
  blob: Blob;
  filename: string;
} {
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const csv = toCsv(categories, [
    { header: 'name', cell: (c) => c.name },
    { header: 'kind', cell: (c) => c.kind },
    {
      header: 'parent',
      cell: (c) => (c.parentId ? (nameById.get(c.parentId) ?? '') : ''),
    },
  ]);
  const today = new Date().toISOString().slice(0, 10);
  return {
    blob: new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    filename: `categories-${today}.csv`,
  };
}
