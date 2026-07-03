'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NewTransaction, TransactionKind } from '@/lib/api/types';
import { queryKeys, invalidates } from '@/lib/query-keys';
import { fetchAccounts } from '@/lib/accounts/api';
import { fetchCategories } from '@/lib/categories/api';
import { createTransaction } from '@/lib/transactions/api';
import { transactionKindLabel } from '@/lib/money';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  TransactionForm,
  type TransactionFormValues,
} from '@/components/transactions/transaction-form';

// Quick-add is the signature create flow — pinned in the sidebar, reachable from
// every screen. OPENING is intentionally absent: a starting balance is set from
// the account flow, not recorded ad hoc here.
const KINDS: TransactionKind[] = ['EXPENSE', 'INCOME', 'TRANSFER'];

export function QuickAdd() {
  const qc = useQueryClient();
  const [openKind, setOpenKind] = useState<TransactionKind | null>(null);

  // Loaded lazily and cached; shared with the accounts/transactions screens.
  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: fetchAccounts,
    enabled: openKind !== null,
  });
  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories,
    queryFn: fetchCategories,
    enabled: openKind !== null,
  });

  const createMutation = useMutation({
    mutationFn: (input: NewTransaction) => createTransaction(input),
    onSuccess: async () => {
      await Promise.all(
        invalidates
          .transaction()
          .map((key) => qc.invalidateQueries({ queryKey: key })),
      );
      setOpenKind(null);
    },
  });

  function onSubmit(v: TransactionFormValues) {
    const payload: NewTransaction = {
      kind: v.kind,
      amount: v.amount,
      date: v.date,
      accountId: v.accountId,
      ...(v.categoryId ? { categoryId: v.categoryId } : {}),
      ...(v.toAccountId ? { toAccountId: v.toAccountId } : {}),
      ...(v.note ? { note: v.note } : {}),
    };
    createMutation.mutate(payload);
  }

  return (
    <>
      <div className="mt-auto rounded-[14px] border border-white/10 bg-pine-soft p-3.5">
        <div className="mb-2.5 flex items-center gap-2 text-[0.82rem] font-semibold text-white/90">
          <span className="size-1.5 rounded-full bg-gold-soft" />
          Quick add
        </div>
        <div className="flex gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                createMutation.reset();
                setOpenKind(k);
              }}
              className="flex-1 rounded-[8px] border border-white/10 bg-white/5 py-1.5 text-center font-mono text-[0.66rem] text-white/80 transition-colors hover:bg-gold hover:text-pine-deep"
            >
              {transactionKindLabel(k)}
            </button>
          ))}
        </div>
      </div>

      <Dialog
        open={openKind !== null}
        onOpenChange={(open) => {
          if (!open) {
            createMutation.reset();
            setOpenKind(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick add</DialogTitle>
            <DialogDescription>
              Record an income, expense, or transfer. It updates your balances
              and dashboard immediately.
            </DialogDescription>
          </DialogHeader>
          {openKind !== null ? (
            <TransactionForm
              accounts={accountsQuery.data ?? []}
              categories={categoriesQuery.data ?? []}
              initial={{ kind: openKind }}
              submitting={createMutation.isPending}
              error={createMutation.isError}
              submitLabel="Add transaction"
              onSubmit={onSubmit}
              onCancel={() => {
                createMutation.reset();
                setOpenKind(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
