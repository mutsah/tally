'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import type { Account, Category } from '@/lib/api/types';
import { queryKeys } from '@/lib/query-keys';
import { fetchAccounts } from '@/lib/accounts/api';
import { fetchCategories } from '@/lib/categories/api';
import {
  fetchTransactions,
  fetchTransactionsCsv,
  type ExportFilters,
} from '@/lib/transactions/api';
import { Button } from '@/components/ui/button';
import {
  TransactionFilters,
  EMPTY_FILTERS,
  type FilterState,
} from '@/components/transactions/transaction-filters';

// FilterState (yyyy-mm-dd dates) → the export/count params (ISO, inclusive day).
function toExportFilters(f: FilterState): ExportFilters {
  return {
    accountId: f.accountId || undefined,
    categoryId: f.categoryId || undefined,
    kind: f.kind || undefined,
    from: f.from ? `${f.from}T00:00:00.000Z` : undefined,
    to: f.to ? `${f.to}T23:59:59.999Z` : undefined,
  };
}

export function ExportView({
  initialAccounts,
  initialCategories,
}: {
  initialAccounts: Account[] | null;
  initialCategories: Category[] | null;
}) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [status, setStatus] = useState<'idle' | 'downloading' | 'error'>('idle');

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: fetchAccounts,
    ...(initialAccounts ? { initialData: initialAccounts } : {}),
  });
  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories,
    queryFn: fetchCategories,
    ...(initialCategories ? { initialData: initialCategories } : {}),
  });

  const params = toExportFilters(filters);
  // A cheap "what will I export?" count from the existing list endpoint.
  const countQuery = useQuery({
    queryKey: [...queryKeys.transactions, 'export-count', params],
    queryFn: () =>
      fetchTransactions({ ...params, pageSize: 1 }).then((p) => p.total),
    placeholderData: keepPreviousData,
  });
  const count = countQuery.data ?? 0;
  const counting = countQuery.isLoading;
  const nothing = !counting && count === 0;

  function changeFilters(next: FilterState) {
    setStatus('idle');
    setFilters(next);
  }

  async function download() {
    setStatus('downloading');
    try {
      const { blob, filename } = await fetchTransactionsCsv(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Export</h1>
        <p className="text-sm text-muted-foreground">
          Download your transactions as a CSV, scoped to the filters below.
          Amounts are exact — transfers and opening balances are included.
        </p>
      </header>

      <TransactionFilters
        filters={filters}
        accounts={accountsQuery.data ?? []}
        categories={categoriesQuery.data ?? []}
        onChange={changeFilters}
        onClear={() => changeFilters(EMPTY_FILTERS)}
      />

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-tally">
        <p className="text-sm">
          {counting ? (
            <span className="text-faint">Counting matching transactions…</span>
          ) : nothing ? (
            <span className="text-muted-foreground">
              No transactions match these filters — nothing to export.
            </span>
          ) : (
            <>
              Ready to export{' '}
              <span className="num font-semibold tabular-nums">{count}</span>{' '}
              transaction{count === 1 ? '' : 's'} as CSV.
            </>
          )}
        </p>

        <div className="flex items-center gap-3">
          <Button
            onClick={download}
            disabled={status === 'downloading' || counting || nothing}
          >
            <Download className="size-4" />
            {status === 'downloading' ? 'Preparing…' : 'Download CSV'}
          </Button>
          {status === 'error' ? (
            <span className="text-sm text-[color:var(--neg)]" role="alert">
              Couldn’t build the export. Please try again.
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
