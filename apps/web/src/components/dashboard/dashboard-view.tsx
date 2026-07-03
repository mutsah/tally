'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type {
  IncomeVsExpense,
  NetWorth,
  RecentTransaction,
  SpendingByCategory,
} from '@/lib/api/types';
import { queryKeys } from '@/lib/query-keys';
import {
  fetchIncomeVsExpense,
  fetchNetWorth,
  fetchRecentActivity,
  fetchSpendingByCategory,
} from '@/lib/dashboard/api';
import {
  DEFAULT_PERIOD,
  periodRange,
  type PeriodKey,
} from '@/lib/dashboard/period';
import { Button } from '@/components/ui/button';
import { NetWorthCard } from './net-worth-card';
import { AccountsBreakdown } from './accounts-breakdown';
import { SpendingOverview } from './spending-overview';
import { StatCards } from './stat-cards';
import { SavingsRateCard } from './savings-rate-card';
import { RecentTransactions } from './recent-transactions';
import { PeriodSelect } from './period-select';

export function DashboardView({
  initialNetWorth,
  initialIncome,
  initialSpending,
  initialRecent,
}: {
  initialNetWorth: NetWorth | null;
  initialIncome: IncomeVsExpense | null;
  initialSpending: SpendingByCategory | null;
  initialRecent: RecentTransaction[] | null;
}) {
  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD);
  const range = periodRange(period);
  const isDefaultPeriod = period === DEFAULT_PERIOD;

  const netWorthQuery = useQuery({
    queryKey: [...queryKeys.dashboard, 'net-worth'],
    queryFn: fetchNetWorth,
    ...(initialNetWorth ? { initialData: initialNetWorth } : {}),
  });
  const recentQuery = useQuery({
    queryKey: [...queryKeys.dashboard, 'recent-activity'],
    queryFn: () => fetchRecentActivity(8),
    ...(initialRecent ? { initialData: initialRecent } : {}),
  });
  const incomeQuery = useQuery({
    queryKey: [...queryKeys.dashboard, 'income-vs-expense', period],
    queryFn: () => fetchIncomeVsExpense(range),
    placeholderData: keepPreviousData,
    ...(isDefaultPeriod && initialIncome ? { initialData: initialIncome } : {}),
  });
  const spendingQuery = useQuery({
    queryKey: [...queryKeys.dashboard, 'spending-by-category', period],
    queryFn: () => fetchSpendingByCategory(range),
    placeholderData: keepPreviousData,
    ...(isDefaultPeriod && initialSpending
      ? { initialData: initialSpending }
      : {}),
  });

  const netWorth = netWorthQuery.data;
  const recent = recentQuery.data ?? [];

  // The always-present read gates loading/error.
  if (netWorthQuery.isError && !netWorth) {
    return <ErrorState onRetry={() => netWorthQuery.refetch()} />;
  }
  if (!netWorth) return <LoadingState />;

  const isEmpty = netWorth.accounts.length === 0 && recent.length === 0;
  if (isEmpty) return <EmptyState />;

  return (
    <div className="flex w-full flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Overview</h1>
        <PeriodSelect value={period} onChange={setPeriod} />
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <NetWorthCard netWorth={netWorth} />
          {incomeQuery.data ? (
            <StatCards totals={incomeQuery.data} period={period} />
          ) : null}
          {spendingQuery.data ? (
            <SpendingOverview spending={spendingQuery.data} />
          ) : null}
          <RecentTransactions transactions={recent} />
        </div>

        <div className="flex flex-col gap-5">
          {incomeQuery.data ? (
            <SavingsRateCard totals={incomeQuery.data} period={period} />
          ) : null}
          <AccountsBreakdown accounts={netWorth.accounts} />
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rounded-xl border border-border bg-card px-6 py-16 text-center shadow-tally">
      <p className="font-mono text-sm text-faint">Loading your dashboard…</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-tally">
      <p className="font-display text-lg">Nothing to show yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Add an account and record a transaction, and your net worth, spending,
        and savings will show up here.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <Button asChild>
          <Link href="/accounts">Add an account</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/transactions">Go to transactions</Link>
        </Button>
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card px-6 py-16 text-center shadow-tally">
      <p className="font-display text-lg">Couldn’t load your dashboard</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The server didn’t answer. Check your connection and try again.
      </p>
      <Button variant="outline" className="mt-4" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
