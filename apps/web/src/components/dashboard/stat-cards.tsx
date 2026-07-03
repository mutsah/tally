import type { IncomeVsExpense } from '@/lib/api/types';
import { periodLabel, type PeriodKey } from '@/lib/dashboard/period';
import { MoneyFigure } from './money-figure';

// Income · Expenses · Saved for the period. No vs-last-month tag — the API
// returns no period-over-period comparison, so none is fabricated.
export function StatCards({
  totals,
  period,
}: {
  totals: IncomeVsExpense;
  period: PeriodKey;
}) {
  const cards: { label: string; value: string; tone?: string }[] = [
    { label: 'Income', value: totals.income, tone: 'text-[color:var(--pos)]' },
    {
      label: 'Expenses',
      value: totals.expense,
      tone: 'text-[color:var(--neg)]',
    },
    { label: 'Saved', value: totals.net },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-border bg-card p-4 shadow-tally"
        >
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-faint">
            {c.label}
          </p>
          <MoneyFigure
            value={c.value}
            className={`mt-1.5 block text-2xl font-semibold ${c.tone ?? ''}`}
          />
          <p className="mt-1 font-mono text-[11px] text-faint">
            {periodLabel(period)}
          </p>
        </div>
      ))}
    </div>
  );
}
