import Link from 'next/link';
import type { IncomeVsExpense } from '@/lib/api/types';
import { formatMoney, moneyToCents, percentOf } from '@/lib/money';
import { periodLabel, type PeriodKey } from '@/lib/dashboard/period';

// Derived stat — kept X% of income. It is a plain arithmetic derivation of the
// income/expense figures, not advice or a recommendation (Tally has no insights).
export function SavingsRateCard({
  totals,
  period,
}: {
  totals: IncomeVsExpense;
  period: PeriodKey;
}) {
  const incomeCents = moneyToCents(totals.income);
  const netCents = moneyToCents(totals.net);
  const rate = percentOf(totals.net, totals.income);

  let body: React.ReactNode;
  if (incomeCents === 0) {
    body = 'No income recorded for this period yet.';
  } else if (netCents <= 0) {
    body = (
      <>
        You spent more than you earned this period —{' '}
        <span className="num">{formatMoney(totals.expense)}</span> out against{' '}
        <span className="num">{formatMoney(totals.income)}</span> in.
      </>
    );
  } else {
    body = (
      <>
        You kept{' '}
        <span className="font-semibold text-[color:var(--gold)]">{rate}%</span>{' '}
        of your income — <span className="num">{formatMoney(totals.net)}</span>{' '}
        saved so far.
      </>
    );
  }

  return (
    <div className="rounded-xl border border-[color:var(--gold)]/30 bg-[color:var(--gold-bg)] p-5 shadow-tally">
      <p className="font-mono text-xs uppercase tracking-[0.12em] text-faint">
        Savings rate · {periodLabel(period)}
      </p>
      <p className="mt-2 text-lg">{body}</p>
      <p className="mt-1 font-mono text-[11px] text-faint">
        Derived from your income and expenses — not advice.
      </p>
      <Link
        href="/transactions"
        className="mt-3 inline-block font-mono text-xs text-[color:var(--gold)] hover:underline"
      >
        See transactions
      </Link>
    </div>
  );
}
