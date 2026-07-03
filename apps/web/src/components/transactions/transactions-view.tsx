'use client';

import { useMemo, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  Account,
  Category,
  PaginatedTransactions,
  Transaction,
  TransactionFilters as ApiFilters,
  TransactionPatch,
} from '@/lib/api/types';
import { queryKeys, invalidates } from '@/lib/query-keys';
import { fetchAccounts } from '@/lib/accounts/api';
import { fetchCategories } from '@/lib/categories/api';
import {
  deleteTransaction,
  fetchTransactions,
  updateTransaction,
} from '@/lib/transactions/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TransactionTable } from './transaction-table';
import {
  TransactionFilters,
  EMPTY_FILTERS,
  type FilterState,
} from './transaction-filters';
import {
  TransactionForm,
  type TransactionFormValues,
} from './transaction-form';
import { DeleteTransactionDialog } from './delete-transaction-dialog';

const PAGE_SIZE = 20;

function toServerFilters(f: FilterState, page: number): ApiFilters {
  return {
    accountId: f.accountId || undefined,
    categoryId: f.categoryId || undefined,
    kind: f.kind || undefined,
    from: f.from ? `${f.from}T00:00:00.000Z` : undefined,
    to: f.to ? `${f.to}T23:59:59.999Z` : undefined,
    page,
    pageSize: PAGE_SIZE,
  };
}

export function TransactionsView({
  initialTransactions,
  initialAccounts,
  initialCategories,
}: {
  initialTransactions: PaginatedTransactions | null;
  initialAccounts: Account[] | null;
  initialCategories: Category[] | null;
}) {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);

  const serverFilters = useMemo(
    () => toServerFilters(filters, page),
    [filters, page],
  );
  const isDefaultView = page === 1 && serverFilters.accountId === undefined &&
    serverFilters.categoryId === undefined &&
    serverFilters.kind === undefined &&
    serverFilters.from === undefined &&
    serverFilters.to === undefined;

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
  const txQuery = useQuery({
    queryKey: [...queryKeys.transactions, serverFilters],
    queryFn: () => fetchTransactions(serverFilters),
    placeholderData: keepPreviousData,
    ...(isDefaultView && initialTransactions
      ? { initialData: initialTransactions }
      : {}),
  });

  const accounts = accountsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const accountsById = useMemo(
    () => new Map((accountsQuery.data ?? []).map((a) => [a.id, a])),
    [accountsQuery.data],
  );
  const categoriesById = useMemo(
    () => new Map((categoriesQuery.data ?? []).map((c) => [c.id, c])),
    [categoriesQuery.data],
  );

  const invalidateTx = () =>
    Promise.all(
      invalidates
        .transaction()
        .map((key) => qc.invalidateQueries({ queryKey: key })),
    );

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TransactionPatch }) =>
      updateTransaction(id, patch),
    onSuccess: async () => {
      await invalidateTx();
      setEditing(null);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: async () => {
      await invalidateTx();
      setDeleting(null);
    },
  });

  function onEditSubmit(v: TransactionFormValues) {
    if (!editing) return;
    updateMutation.mutate({
      id: editing.id,
      patch: {
        amount: v.amount,
        date: v.date,
        accountId: v.accountId,
        categoryId: v.categoryId,
        toAccountId: v.toAccountId,
        note: v.note,
      },
    });
  }

  const page1 = txQuery.data;
  // Kind (like every filter) is applied server-side now, so the page IS the result.
  const rows = page1?.data ?? [];

  const total = page1?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function changeFilters(next: FilterState) {
    setFilters(next);
    setPage(1);
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Every movement across your accounts. Record new ones with Quick add in
          the sidebar.
        </p>
      </header>

      <TransactionFilters
        filters={filters}
        accounts={accounts}
        categories={categories}
        onChange={changeFilters}
        onClear={() => changeFilters(EMPTY_FILTERS)}
      />

      {txQuery.isError && !txQuery.data ? (
        <ErrorState onRetry={() => txQuery.refetch()} />
      ) : txQuery.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState hasFilters={!isDefaultView} />
      ) : (
        <>
          <TransactionTable
            transactions={rows}
            accountsById={accountsById}
            categoriesById={categoriesById}
            onEdit={setEditing}
            onDelete={setDeleting}
          />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="font-mono text-xs">
              {total} transaction{total === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || txQuery.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="font-mono text-xs">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || txQuery.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Edit — same kind-adaptive form, kind fixed. */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            updateMutation.reset();
            setEditing(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit transaction</DialogTitle>
            <DialogDescription>
              Amount, date, account, and details. The type is fixed after
              creation.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <TransactionForm
              accounts={accounts}
              categories={categories}
              fixedKind={editing.kind}
              initial={{
                kind: editing.kind,
                amount: editing.amount,
                date: editing.date,
                accountId: editing.accountId,
                categoryId: editing.categoryId,
                toAccountId: editing.toAccountId,
                note: editing.note,
              }}
              submitting={updateMutation.isPending}
              error={updateMutation.isError}
              submitLabel="Save changes"
              onSubmit={onEditSubmit}
              onCancel={() => {
                updateMutation.reset();
                setEditing(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <DeleteTransactionDialog
        tx={deleting}
        accountsById={accountsById}
        deleting={deleteMutation.isPending}
        error={deleteMutation.isError}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        onOpenChange={(open) => {
          if (!open) {
            deleteMutation.reset();
            setDeleting(null);
          }
        }}
      />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rounded-xl border border-border bg-card px-6 py-16 text-center shadow-tally">
      <p className="font-mono text-sm text-faint">Loading transactions…</p>
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-tally">
      <p className="font-display text-lg">
        {hasFilters ? 'Nothing matches these filters' : 'No transactions yet'}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasFilters
          ? 'Try widening the date range or clearing a filter.'
          : 'Use Quick add in the sidebar to record your first income, expense, or transfer.'}
      </p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card px-6 py-16 text-center shadow-tally">
      <p className="font-display text-lg">Couldn’t load your transactions</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The server didn’t answer. Check your connection and try again.
      </p>
      <Button variant="outline" className="mt-4" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
