import type {
  NewOpeningBalance,
  NewTransaction,
  PaginatedTransactions,
  Transaction,
  TransactionFilters,
  TransactionKind,
  TransactionPatch,
} from '@/lib/api/types';
import { ApiError, jsonInit, parseJson } from '@/lib/api/http';

/**
 * Client-side transactions API — calls the same-origin BFF, which forwards the
 * session token to Nest. Money stays a string end to end (amounts are never
 * parsed to a number here or anywhere downstream).
 */
export function buildTransactionsQuery(filters: TransactionFilters): string {
  const params = new URLSearchParams();
  if (filters.accountId) params.set('accountId', filters.accountId);
  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  if (filters.kind) params.set('kind', filters.kind);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function fetchTransactions(
  filters: TransactionFilters,
): Promise<PaginatedTransactions> {
  return fetch(`/api/transactions${buildTransactionsQuery(filters)}`, {
    cache: 'no-store',
  }).then(parseJson<PaginatedTransactions>);
}

export function createTransaction(
  input: NewTransaction,
): Promise<Transaction> {
  return fetch('/api/transactions', jsonInit('POST', input)).then(
    parseJson<Transaction>,
  );
}

export function updateTransaction(
  id: string,
  patch: TransactionPatch,
): Promise<Transaction> {
  return fetch(`/api/transactions/${id}`, jsonInit('PATCH', patch)).then(
    parseJson<Transaction>,
  );
}

export function deleteTransaction(id: string): Promise<Transaction> {
  return fetch(`/api/transactions/${id}`, { method: 'DELETE' }).then(
    parseJson<Transaction>,
  );
}

// CSV export filters. NB: the export endpoint takes NO page/pageSize — sending
// them would be rejected (forbidNonWhitelisted). Only the scoping filters go.
export interface ExportFilters {
  accountId?: string;
  categoryId?: string;
  kind?: TransactionKind;
  from?: string; // ISO 8601
  to?: string; // ISO 8601
}

function exportQuery(f: ExportFilters): string {
  const params = new URLSearchParams();
  if (f.accountId) params.set('accountId', f.accountId);
  if (f.categoryId) params.set('categoryId', f.categoryId);
  if (f.kind) params.set('kind', f.kind);
  if (f.from) params.set('from', f.from);
  if (f.to) params.set('to', f.to);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Download the filtered transactions CSV via the same-origin BFF. Returns the
 * file blob + the server-set filename (from Content-Disposition), leaving the
 * DOM download trigger to the caller. Money is untouched — the CSV is the
 * backend's exact 2-dp strings.
 */
export async function fetchTransactionsCsv(
  filters: ExportFilters,
): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`/api/transactions/export${exportQuery(filters)}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new ApiError(res.status);
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const filename =
    match?.[1] ?? `tally-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  return { blob, filename };
}

/**
 * Record an account's starting balance as an OPENING transaction. The DB's
 * one-per-account unique index is the backstop; a duplicate is rejected as a
 * clean 400 (surfaced here as an ApiError with status 400).
 */
export function createOpeningBalance(
  input: NewOpeningBalance,
): Promise<Transaction> {
  return fetch(
    '/api/transactions',
    jsonInit('POST', { ...input, kind: 'OPENING' as const }),
  ).then(parseJson<Transaction>);
}
