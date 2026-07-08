import { useMemo } from 'react';
import Link from 'next/link';
import type { Budget, SpendingByCategory } from '@/lib/api/types';
import { formatMoney, moneyToCents, percentOf } from '@/lib/money';

// Read-only: visualizes this month's spend against each category's monthly limit.
// Editing budgets lives on /budgets — this card never mutates. Money stays a
// string for display (formatMoney); bar widths are display-only geometry from
// moneyToCents/percentOf, never written back or shown as the money value.

interface AdherenceRow {
  categoryId: string;
  name: string;
  spent: string;
  limit: string;
  usedPct: number;
  over: boolean;
}

/** categoryId → { name, spent } for every expense category (parents carry the
 *  rollup total, children their direct total), so any budgeted category resolves. */
function spendByCategory(
  spending: SpendingByCategory,
): Map<string, { name: string; total: string }> {
  const map = new Map<string, { name: string; total: string }>();
  for (const parent of spending.categories) {
    map.set(parent.categoryId, { name: parent.name, total: parent.total });
    for (const child of parent.children) {
      map.set(child.categoryId, { name: child.name, total: child.total });
    }
  }
  return map;
}

export function BudgetAdherenceCard({
  budgets,
  spending,
}: {
  budgets: Budget[];
  spending: SpendingByCategory | null;
}) {
  const rows = useMemo<AdherenceRow[]>(() => {
    const spend = spending ? spendByCategory(spending) : new Map();
    return budgets
      .map((b) => {
        const info = spend.get(b.categoryId);
        const spent = info?.total ?? '0.00';
        return {
          categoryId: b.categoryId,
          name: info?.name ?? 'Category',
          spent,
          limit: b.amount,
          usedPct: percentOf(spent, b.amount),
          over: moneyToCents(spent) > moneyToCents(b.amount),
        };
      })
      // Highest utilization first (over-budget rises to the top).
      .sort((a, b) => b.usedPct - a.usedPct);
  }, [budgets, spending]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-tally">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold">Budget adherence</h2>
        <span className="font-mono text-[0.6rem] uppercase tracking-wide text-faint">
          This month
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="px-2 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No budgets yet. Set a monthly limit on an expense category to track
            how you’re tracking against it.
          </p>
          <Link
            href="/budgets"
            className="mt-2 inline-block text-sm font-medium text-[color:var(--gold)]"
          >
            Set budgets →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.categoryId}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {row.name}
                </span>
                <span className="num text-sm tabular-nums">
                  {formatMoney(row.spent)}
                  <span className="text-faint"> / {formatMoney(row.limit)}</span>
                </span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"
                role="progressbar"
                aria-valuenow={row.usedPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${row.name} budget used`}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, row.usedPct)}%`,
                    backgroundColor: row.over
                      ? 'var(--neg)'
                      : 'var(--pine-soft)',
                  }}
                />
              </div>
              <p className="mt-1 font-mono text-xs">
                {row.over ? (
                  <span className="text-[color:var(--neg)]">
                    Over budget · {row.usedPct}%
                  </span>
                ) : (
                  <span className="text-faint">{row.usedPct}% used</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
