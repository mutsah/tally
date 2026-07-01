'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import type { Account, NewAccount } from '@/lib/api/types';
import { queryKeys, invalidates } from '@/lib/query-keys';
import { fetchAccounts, createAccount } from '@/lib/accounts/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AccountRow } from './account-row';
import { AccountForm } from './account-form';

export function AccountsView({
  initialAccounts,
}: {
  initialAccounts: Account[] | null;
}) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: fetchAccounts,
    ...(initialAccounts ? { initialData: initialAccounts } : {}),
  });

  const invalidateAccounts = () =>
    Promise.all(
      invalidates.account().map((key) => qc.invalidateQueries({ queryKey: key })),
    );

  const createMutation = useMutation({
    mutationFn: (input: NewAccount) => createAccount(input),
    onSuccess: async () => {
      await invalidateAccounts();
      setCreating(false);
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
        <Button onClick={() => setCreating(true)}>New account</Button>
      </header>

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
                  onInvalidate={invalidateAccounts}
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
                      onInvalidate={invalidateAccounts}
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
