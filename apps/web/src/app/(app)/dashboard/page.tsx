import { nestFetch } from '@/lib/api/nest-fetch';
import type {
  IncomeVsExpense,
  NetWorth,
  RecentTransaction,
  SpendingByCategory,
} from '@/lib/api/types';
import { DEFAULT_PERIOD, periodRange } from '@/lib/dashboard/period';
import { DashboardView } from '@/components/dashboard/dashboard-view';

// Server component: seeds all four read-only dashboard endpoints through the F1
// session. Period-scoped reads use the default period (this month); the client
// re-fetches on period change. Money stays a string.
export default async function DashboardPage() {
  const range = periodRange(DEFAULT_PERIOD);
  const rangeQs = new URLSearchParams();
  if (range.from) rangeQs.set('from', range.from);
  if (range.to) rangeQs.set('to', range.to);
  const qs = rangeQs.toString() ? `?${rangeQs.toString()}` : '';

  const [nw, inc, spend, recent] = await Promise.all([
    nestFetch('/dashboard/net-worth'),
    nestFetch(`/dashboard/income-vs-expense${qs}`),
    nestFetch(`/dashboard/spending-by-category${qs}`),
    nestFetch('/dashboard/recent-activity?limit=8'),
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
    />
  );
}
