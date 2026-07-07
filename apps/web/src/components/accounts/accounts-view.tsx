'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { X } from 'lucide-react';
import type { Account } from '@/lib/api/types';
import { queryKeys, invalidates } from '@/lib/query-keys';
import { fetchAccounts, createAccount } from '@/lib/accounts/api';
import { buildAccountsCsv } from '@/lib/accounts/csv';
import { createOpeningBalance, fetchTransactions } from '@/lib/transactions/api';
import { isValuedAccount } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { TableExportButton } from '@/components/table-export-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AccountRow } from './account-row';
import { AccountForm, type AccountFormValues } from './account-form';

export function AccountsView({
  initialAccounts,
}: {
  initialAccounts: Account[] | null;
}) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: fetchAccounts,
    ...(initialAccounts ? { initialData: initialAccounts } : {}),
  });
  // An OPENING is only valid on an account with NO transactions, so "Set starting
  // balance" shows only for derived accounts with zero activity — not merely
  // those without an existing OPENING. We check "has any transaction?" per
  // derived account with one cheap existence query (pageSize:1 → total > 0),
  // covering both source and transfer-destination activity. Keyed under
  // ['transactions', …] so any transaction mutation refreshes it.
  const derivedIds = useMemo(
    () =>
      (accountsQuery.data ?? [])
        .filter((a) => !isValuedAccount(a.type))
        .map((a) => a.id)
        .sort(),
    [accountsQuery.data],
  );
  const activityQuery = useQuery({
    queryKey: [...queryKeys.transactions, 'account-activity', derivedIds],
    queryFn: async () => {
      const results = await Promise.all(
        derivedIds.map((id) =>
          fetchTransactions({ accountId: id, pageSize: 1 }).then(
            (page) => [id, page.total > 0] as const,
          ),
        ),
      );
      return new Set(results.filter(([, has]) => has).map(([id]) => id));
    },
    enabled: derivedIds.length > 0,
  });
  const accountsWithActivity = activityQuery.data ?? new Set<string>();
  const activityResolved = derivedIds.length === 0 || activityQuery.isSuccess;

  // A transaction (the OPENING) touches balances, so invalidate the full set —
  // accounts, dashboard, and transactions (which refreshes the openings query).
  const invalidateAll = () =>
    Promise.all(
      invalidates
        .transaction()
        .map((key) => qc.invalidateQueries({ queryKey: key })),
    );

  const createMutation = useMutation({
    // Account first, THEN the optional OPENING — never atomic across endpoints.
    mutationFn: async (values: AccountFormValues) => {
      const account = await createAccount({
        name: values.name,
        type: values.type,
      });
      if (values.opening) {
        try {
          await createOpeningBalance({
            accountId: account.id,
            amount: values.opening.amount,
            date: values.opening.date,
          });
        } catch {
          // Forgiving: keep the account, flag the balance as unsaved.
          return { openingFailed: true };
        }
      }
      return { openingFailed: false };
    },
    onSuccess: async (result) => {
      await invalidateAll();
      setCreating(false);
      setNotice(
        result.openingFailed
          ? 'Account created, but its starting balance didn’t save. You can set it from the account below.'
          : null,
      );
    },
  });

  const accounts = accountsQuery.data ?? [];
  const { active, archived } = useMemo(() => {
    const list = accountsQuery.data ?? [];
    return {
      active: list.filter((a) => !a.archived),
      archived: list.filter((a) => a.archived),
    };
  }, [accountsQuery.data]);

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Where your money sits. Balances update as transactions land.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TableExportButton
            getCsv={() => Promise.resolve(buildAccountsCsv(accounts))}
            disabled={!accountsQuery.data}
          />
          <Button onClick={() => setCreating(true)}>New account</Button>
        </div>
      </header>

      {notice ? (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold-bg)] px-4 py-3 text-sm">
          <p className="text-foreground">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 text-faint hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <Dialog
        open={creating}
        onOpenChange={(open) => {
          if (!open) {
            createMutation.reset();
            setCreating(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New account</DialogTitle>
            <DialogDescription>
              Add a bank, cash, or investment account to start tracking.
            </DialogDescription>
          </DialogHeader>
          <AccountForm
            submitting={createMutation.isPending}
            error={createMutation.isError}
            onCancel={() => {
              createMutation.reset();
              setCreating(false);
            }}
            onSubmit={(input) => createMutation.mutate(input)}
          />
        </DialogContent>
      </Dialog>

      {accountsQuery.isError && !initialAccounts ? (
        <ErrorState onRetry={() => accountsQuery.refetch()} />
      ) : accounts.length === 0 && !accountsQuery.isLoading ? (
        <EmptyState creating={creating} onCreate={() => setCreating(true)} />
      ) : (
        <>
          <section className="flex flex-col gap-2">
            {active.length === 0 ? (
              <p className="text-sm text-faint">No active accounts.</p>
            ) : (
              active.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  onInvalidate={invalidateAll}
                  hasActivity={accountsWithActivity.has(account.id)}
                  activityResolved={activityResolved}
                />
              ))
            )}
          </section>

          {archived.length > 0 ? (
            <section className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="self-start font-mono text-xs text-faint hover:text-foreground"
              >
                {showArchived ? '▾' : '▸'} Archived ({archived.length})
              </button>
              {showArchived
                ? archived.map((account) => (
                    <AccountRow
                      key={account.id}
                      account={account}
                      onInvalidate={invalidateAll}
                      hasActivity={accountsWithActivity.has(account.id)}
                      activityResolved={activityResolved}
                    />
                  ))
                : null}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function EmptyState({
  creating,
  onCreate,
}: {
  creating: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center shadow-tally">
      <p className="font-display text-lg">No accounts yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Add your first account — a bank, some cash, an investment — to start
        tracking.
      </p>
      {!creating ? (
        <Button className="mt-4" onClick={onCreate}>
          New account
        </Button>
      ) : null}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card px-6 py-12 text-center shadow-tally">
      <p className="font-display text-lg">Couldn’t load your accounts</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The server didn’t answer. Check your connection and try again.
      </p>
      <Button variant="outline" className="mt-4" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
