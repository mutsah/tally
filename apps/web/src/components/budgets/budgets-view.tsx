'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { Budget, Category } from '@/lib/api/types';
import { queryKeys } from '@/lib/query-keys';
import { fetchCategories } from '@/lib/categories/api';
import { fetchBudgets } from '@/lib/budgets/api';
import { Button } from '@/components/ui/button';
import { BudgetRow } from './budget-row';

export function BudgetsView({
  initialCategories,
  initialBudgets,
}: {
  initialCategories: Category[] | null;
  initialBudgets: Budget[] | null;
}) {
  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories,
    queryFn: fetchCategories,
    ...(initialCategories ? { initialData: initialCategories } : {}),
  });
  const budgetsQuery = useQuery({
    queryKey: queryKeys.budgets,
    queryFn: fetchBudgets,
    ...(initialBudgets ? { initialData: initialBudgets } : {}),
  });

  const expenseCategories = useMemo(
    () => (categoriesQuery.data ?? []).filter((c) => c.kind === 'EXPENSE'),
    [categoriesQuery.data],
  );
  const budgetByCategory = useMemo(
    () => new Map((budgetsQuery.data ?? []).map((b) => [b.categoryId, b])),
    [budgetsQuery.data],
  );

  const isLoading = categoriesQuery.isLoading || budgetsQuery.isLoading;
  const isError =
    (categoriesQuery.isError && !categoriesQuery.data) ||
    (budgetsQuery.isError && !budgetsQuery.data);

  return (
    <div className="flex w-full flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Budgets</h1>
        <p className="text-sm text-muted-foreground">
          Set a monthly spending limit on any expense category. Leave one blank to
          track it without a limit.
        </p>
      </header>

      {isError ? (
        <ErrorState
          onRetry={() => {
            void categoriesQuery.refetch();
            void budgetsQuery.refetch();
          }}
        />
      ) : isLoading ? (
        <LoadingState />
      ) : expenseCategories.length === 0 ? (
        <EmptyState />
      ) : (
        <section className="rounded-xl border border-border bg-card p-4 shadow-tally">
          {expenseCategories.map((category) => (
            <BudgetRow
              key={category.id}
              category={category}
              budget={budgetByCategory.get(category.id)}
              isChild={category.parentId !== null}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rounded-xl border border-border bg-card px-6 py-16 text-center shadow-tally">
      <p className="font-mono text-sm text-faint">Loading budgets…</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-tally">
      <p className="font-display text-lg">No expense categories yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Budgets attach to expense categories. Add one first, then set its monthly
        limit here.
      </p>
      <Button asChild className="mt-4">
        <Link href="/categories">Go to Categories</Link>
      </Button>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card px-6 py-16 text-center shadow-tally">
      <p className="font-display text-lg">Couldn’t load your budgets</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The server didn’t answer. Check your connection and try again.
      </p>
      <Button variant="outline" className="mt-4" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
