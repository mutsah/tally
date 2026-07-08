import { nestFetch } from '@/lib/api/nest-fetch';
import type {
  Budget,
  IncomeVsExpense,
  NetWorth,
  RecentTransaction,
  SpendingByCategory,
} from '@/lib/api/types';
import { DEFAULT_PERIOD, periodRange } from '@/lib/dashboard/period';
import { DashboardView } from '@/components/dashboard/dashboard-view';

// Server component: seeds the read-only dashboard reads through the F1 session.
// Period-scoped reads use the default period (this month); the client re-fetches
// on period change. The this-month spending seed also feeds the budget-adherence
// card (always current-month); budgets seed that card too. Money is a string.
export default async function DashboardPage() {
  const range = periodRange(DEFAULT_PERIOD);
  const rangeQs = new URLSearchParams();
  if (range.from) rangeQs.set('from', range.from);
  if (range.to) rangeQs.set('to', range.to);
  const qs = rangeQs.toString() ? `?${rangeQs.toString()}` : '';

  const [nw, inc, spend, recent, budgets] = await Promise.all([
    nestFetch('/dashboard/net-worth'),
    nestFetch(`/dashboard/income-vs-expense${qs}`),
    nestFetch(`/dashboard/spending-by-category${qs}`),
    nestFetch('/dashboard/recent-activity?limit=5'),
    nestFetch('/budgets'),
  ]);

  return (
    <DashboardView
      initialNetWorth={nw.status === 200 ? (nw.data as NetWorth) : null}
      initialIncome={inc.status === 200 ? (inc.data as IncomeVsExpense) : null}
      initialSpending={
        spend.status === 200 ? (spend.data as SpendingByCategory) : null
      }
      initialRecent={
        recent.status === 200 ? (recent.data as RecentTransaction[]) : null
      }
      initialBudgets={budgets.status === 200 ? (budgets.data as Budget[]) : null}
    />
  );
}
