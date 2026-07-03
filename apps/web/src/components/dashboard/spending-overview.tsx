import { useMemo } from 'react';
import type { SpendingByCategory } from '@/lib/api/types';
import { formatMoney, moneyToCents, percentOf } from '@/lib/money';
import { Donut } from './donut';

// Category rollups are done SERVER-SIDE (parent total = own + children). We show
// only categories with spend > 0 (the endpoint returns every expense category,
// including zero-total ones), largest first.
const PALETTE = [
  'var(--pine)',
  'var(--gold)',
  'var(--pos)',
  'var(--neg)',
  'var(--pine-soft)',
  'var(--gold-soft)',
  'var(--faint)',
];

export function SpendingOverview({
  spending,
}: {
  spending: SpendingByCategory;
}) {
  const spent = useMemo(
    () =>
      spending.categories
        .filter((c) => moneyToCents(c.total) > 0)
        .sort((a, b) => moneyToCents(b.total) - moneyToCents(a.total)),
    [spending.categories],
  );

  const grandCents = moneyToCents(spending.grandTotal);
  const segments = spent.map((c, i) => ({
    id: c.categoryId,
    color: PALETTE[i % PALETTE.length],
    fraction: grandCents > 0 ? moneyToCents(c.total) / grandCents : 0,
  }));
  const top = spent[0];

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-tally">
      <h2 className="mb-3 font-display text-lg font-semibold">
        Spending overview
      </h2>

      {spent.length === 0 ? (
        <p className="px-2 py-10 text-center text-sm text-faint">
          No spending recorded for this period.
        </p>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <Donut segments={segments}>
            <span className="font-mono text-[0.6rem] uppercase tracking-wide text-faint">
              Total spent
            </span>
            <span className="num text-lg font-semibold tabular-nums">
              {formatMoney(spending.grandTotal)}
            </span>
            {top ? (
              <span className="mt-0.5 font-mono text-[0.62rem] text-faint">
                Top · {top.name}
              </span>
            ) : null}
          </Donut>

          <ul className="w-full flex-1 space-y-1.5">
            {spent.map((c, i) => (
              <li key={c.categoryId} className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {c.name}
                </span>
                <span className="num text-sm tabular-nums">
                  {formatMoney(c.total)}
                </span>
                <span className="w-10 text-right font-mono text-xs text-faint">
                  {percentOf(c.total, spending.grandTotal)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
