// Dashboard period selector. The API takes optional `from`/`to` (ISO); omitting
// both sums all-time. There's no server-side "this month", so the client maps a
// period key to a deterministic UTC range. Ranges are month/year aligned (not
// "now") so SSR and client hydration compute identical bounds → cache keys match.

export type PeriodKey =
  | 'this-month'
  | 'last-month'
  | 'last-3-months'
  | 'this-year'
  | 'all-time';

export const DEFAULT_PERIOD: PeriodKey = 'this-month';

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'this-month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: 'last-3-months', label: 'Last 3 months' },
  { key: 'this-year', label: 'This year' },
  { key: 'all-time', label: 'All time' },
];

export function periodLabel(key: PeriodKey): string {
  return PERIODS.find((p) => p.key === key)?.label ?? 'This month';
}

function startOfMonth(year: number, month0: number): string {
  return new Date(Date.UTC(year, month0, 1, 0, 0, 0, 0)).toISOString();
}
function endOfMonth(year: number, month0: number): string {
  // Day 0 of the next month = last day of this month.
  return new Date(Date.UTC(year, month0 + 1, 0, 23, 59, 59, 999)).toISOString();
}

export interface PeriodRange {
  from?: string;
  to?: string;
}

/** Resolve a period key to a concrete range using the current UTC month/year. */
export function periodRange(key: PeriodKey): PeriodRange {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();

  switch (key) {
    case 'this-month':
      return { from: startOfMonth(y, m), to: endOfMonth(y, m) };
    case 'last-month':
      return { from: startOfMonth(y, m - 1), to: endOfMonth(y, m - 1) };
    case 'last-3-months':
      return { from: startOfMonth(y, m - 2), to: endOfMonth(y, m) };
    case 'this-year':
      return {
        from: new Date(Date.UTC(y, 0, 1)).toISOString(),
        to: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)).toISOString(),
      };
    case 'all-time':
      return {};
  }
}
