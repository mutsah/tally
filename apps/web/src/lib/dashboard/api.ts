import type {
  IncomeVsExpense,
  NetWorth,
  RecentTransaction,
  SpendingByCategory,
} from '@/lib/api/types';
import { parseJson } from '@/lib/api/http';
import type { PeriodRange } from './period';

/**
 * Client-side dashboard API — read-only, via the same-origin BFF (session token
 * forwarded to Nest). Money stays a string end to end.
 */
function rangeQuery(range: PeriodRange): string {
  const params = new URLSearchParams();
  if (range.from) params.set('from', range.from);
  if (range.to) params.set('to', range.to);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function fetchNetWorth(): Promise<NetWorth> {
  return fetch('/api/dashboard/net-worth', { cache: 'no-store' }).then(
    parseJson<NetWorth>,
  );
}

export function fetchIncomeVsExpense(
  range: PeriodRange,
): Promise<IncomeVsExpense> {
  return fetch(`/api/dashboard/income-vs-expense${rangeQuery(range)}`, {
    cache: 'no-store',
  }).then(parseJson<IncomeVsExpense>);
}

export function fetchSpendingByCategory(
  range: PeriodRange,
): Promise<SpendingByCategory> {
  return fetch(`/api/dashboard/spending-by-category${rangeQuery(range)}`, {
    cache: 'no-store',
  }).then(parseJson<SpendingByCategory>);
}

export function fetchRecentActivity(
  limit = 8,
): Promise<RecentTransaction[]> {
  return fetch(`/api/dashboard/recent-activity?limit=${limit}`, {
    cache: 'no-store',
  }).then(parseJson<RecentTransaction[]>);
}
