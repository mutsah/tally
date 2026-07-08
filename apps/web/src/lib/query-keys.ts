/**
 * TanStack Query keys + cache-invalidation map (F0 skeleton).
 *
 * Maintained explicitly, per CLAUDE.md, rather than guessed per call. No queries
 * are wired yet — features fill these in (F2–F6). A transaction touches balances,
 * so it always invalidates ['transactions'], ['dashboard'], AND ['accounts'].
 */
export const queryKeys = {
  accounts: ['accounts'] as const,
  transactions: ['transactions'] as const,
  categories: ['categories'] as const,
  budgets: ['budgets'] as const,
  dashboard: ['dashboard'] as const,
  valuations: (accountId: string) => ['valuations', accountId] as const,
};

/** Read-only key list. */
export type QueryKey =
  | typeof queryKeys.accounts
  | typeof queryKeys.transactions
  | typeof queryKeys.categories
  | typeof queryKeys.budgets
  | typeof queryKeys.dashboard
  | ReturnType<typeof queryKeys.valuations>;

/**
 * Which query keys each mutation invalidates. Mirrors the map in
 * docs/tally-engineering-spec.html.
 */
export const invalidates = {
  transaction: (): QueryKey[] => [
    queryKeys.transactions,
    queryKeys.dashboard,
    queryKeys.accounts,
  ],
  account: (): QueryKey[] => [queryKeys.accounts, queryKeys.dashboard],
  category: (): QueryKey[] => [queryKeys.categories, queryKeys.dashboard],
  // Budgets feed the dashboard's budget-adherence chart (Track 4).
  budget: (): QueryKey[] => [queryKeys.budgets, queryKeys.dashboard],
  valuation: (accountId: string): QueryKey[] => [
    queryKeys.accounts,
    queryKeys.dashboard,
    queryKeys.valuations(accountId),
  ],
} as const;
