'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Budget, Category } from '@/lib/api/types';
import { invalidates } from '@/lib/query-keys';
import {
  createBudget,
  deleteBudget,
  fetchBudgets,
  updateBudget,
} from '@/lib/budgets/api';
import { ApiError } from '@/lib/api/http';
import { formatMoney } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Same money rule as the rest of the app: positive, up to 2 decimals. The value
// is kept and sent as a raw string — never parsed to a number.
const MONEY_RE = /^\d+(\.\d{1,2})?$/;

export function BudgetRow({
  category,
  budget,
  isChild,
}: {
  category: Category;
  budget?: Budget;
  isChild: boolean;
}) {
  const qc = useQueryClient();
  const [value, setValue] = useState(budget?.amount ?? '');
  const [error, setError] = useState<string | null>(null);

  const invalidate = () =>
    Promise.all(
      invalidates.budget().map((key) => qc.invalidateQueries({ queryKey: key })),
    );

  const saveMutation = useMutation({
    mutationFn: async (amount: string): Promise<Budget> => {
      if (budget) return updateBudget(budget.id, { amount });
      try {
        return await createBudget({ categoryId: category.id, amount });
      } catch (err) {
        // Raced with another create (409 already budgeted) → update instead of
        // surfacing a dead error: fetch the now-existing budget and patch it.
        if (err instanceof ApiError && err.status === 409) {
          const existing = (await fetchBudgets()).find(
            (b) => b.categoryId === category.id,
          );
          if (existing) return updateBudget(existing.id, { amount });
        }
        throw err;
      }
    },
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
  });

  const clearMutation = useMutation({
    mutationFn: (): Promise<Budget> => {
      if (!budget) return Promise.reject(new Error('no budget to clear'));
      return deleteBudget(budget.id);
    },
    onSuccess: async () => {
      setValue('');
      setError(null);
      await invalidate();
    },
  });

  function onSave() {
    setError(null);
    if (!MONEY_RE.test(value) || !/[1-9]/.test(value)) {
      setError('Enter an amount greater than 0 (up to 2 decimals).');
      return;
    }
    saveMutation.mutate(value);
  }

  const busy = saveMutation.isPending || clearMutation.isPending;
  const mutationError = saveMutation.isError
    ? saveMutation.error instanceof ApiError
      ? saveMutation.error.message
      : 'Couldn’t save the budget. Please try again.'
    : clearMutation.isError
      ? 'Couldn’t clear the budget. Please try again.'
      : null;
  const shownError = error ?? mutationError;

  return (
    <div
      className={`flex flex-wrap items-center gap-3 border-b border-border py-3 last:border-b-0 ${
        isChild ? 'pl-6' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{category.name}</p>
        <p className="font-mono text-xs text-faint">
          {budget ? `Limit ${formatMoney(budget.amount)}/mo` : 'No limit set'}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Input
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0.00"
          className="w-28 text-right font-mono"
          aria-label={`Monthly limit for ${category.name}`}
        />
        <Button size="sm" onClick={onSave} disabled={busy}>
          {saveMutation.isPending ? 'Saving…' : budget ? 'Update' : 'Set'}
        </Button>
        {budget ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => clearMutation.mutate()}
            disabled={busy}
          >
            Clear
          </Button>
        ) : null}
      </div>

      {shownError ? (
        <p className="w-full text-sm text-[color:var(--neg)]" role="alert">
          {shownError}
        </p>
      ) : null}
    </div>
  );
}
