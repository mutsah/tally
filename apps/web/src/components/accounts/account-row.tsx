'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { Account, AccountPatch } from '@/lib/api/types';
import { updateAccount } from '@/lib/accounts/api';
import { formatMoney, accountKindLabel, isValuedAccount } from '@/lib/money';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createOpeningBalance } from '@/lib/transactions/api';
import { ApiError } from '@/lib/api/http';
import { AccountForm } from './account-form';
import { ValuationForm } from './valuation-form';
import { SetOpeningDialog } from './set-opening-dialog';

export function AccountRow({
  account,
  onInvalidate,
  hasActivity,
  activityResolved,
}: {
  account: Account;
  onInvalidate: () => Promise<unknown>;
  hasActivity: boolean;
  activityResolved: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [valuing, setValuing] = useState(false);
  const [settingOpening, setSettingOpening] = useState(false);

  const patchMutation = useMutation({
    mutationFn: (patch: AccountPatch) => updateAccount(account.id, patch),
    onSuccess: async () => {
      await onInvalidate();
      setEditing(false);
    },
  });

  const openingMutation = useMutation({
    mutationFn: (values: { amount: string; date: string }) =>
      createOpeningBalance({
        accountId: account.id,
        amount: values.amount,
        date: values.date,
      }),
    onSuccess: async () => {
      await onInvalidate();
      setSettingOpening(false);
    },
  });

  const valued = isValuedAccount(account.type);
  // A starting balance is only valid on a derived account with NO transactions
  // yet (an opening on top of activity would double-state the balance). The
  // action hides once the account has any activity, and never shows for valued
  // accounts (which use valuations).
  const canSetOpening = !valued && activityResolved && !hasActivity;

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-tally">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{account.name}</span>
            {account.archived ? (
              <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-faint">
                Archived
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex items-center gap-2 font-mono text-xs text-faint">
            <span>{accountKindLabel(account.type)}</span>
            <span aria-hidden>·</span>
            <span>{valued ? 'from latest valuation' : 'from transactions'}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="num text-right text-lg tabular-nums">
            {formatMoney(account.balance)}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Rename
        </Button>
        {valued ? (
          <Button size="sm" variant="ghost" onClick={() => setValuing(true)}>
            Record value
          </Button>
        ) : null}
        {canSetOpening ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              openingMutation.reset();
              setSettingOpening(true);
            }}
          >
            Set starting balance
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          disabled={patchMutation.isPending}
          onClick={() => patchMutation.mutate({ archived: !account.archived })}
        >
          {account.archived ? 'Unarchive' : 'Archive'}
        </Button>
        {patchMutation.isError && !editing ? (
          <span className="text-xs text-[color:var(--neg)]" role="alert">
            Couldn’t save — try again.
          </span>
        ) : null}
      </div>

      {/* Edit (rename) — same form, pre-filled, type locked. */}
      <Dialog
        open={editing}
        onOpenChange={(open) => {
          if (!open) {
            patchMutation.reset();
            setEditing(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit account</DialogTitle>
            <DialogDescription>
              Rename this account. Its type is fixed after creation.
            </DialogDescription>
          </DialogHeader>
          <AccountForm
            initialName={account.name}
            lockedType={account.type}
            submitting={patchMutation.isPending}
            error={patchMutation.isError}
            onCancel={() => {
              patchMutation.reset();
              setEditing(false);
            }}
            onSubmit={(input) => patchMutation.mutate({ name: input.name })}
          />
        </DialogContent>
      </Dialog>

      {/* Record value — valued accounts only. */}
      {valued ? (
        <Dialog open={valuing} onOpenChange={setValuing}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record value</DialogTitle>
              <DialogDescription>
                Snapshot the current value of {account.name}. Its balance tracks
                the latest snapshot.
              </DialogDescription>
            </DialogHeader>
            <ValuationForm
              accountId={account.id}
              onDone={async () => {
                await onInvalidate();
                setValuing(false);
              }}
            />
          </DialogContent>
        </Dialog>
      ) : null}

      {/* Set starting balance — derived accounts with no transactions yet. */}
      {!valued ? (
        <SetOpeningDialog
          account={account}
          open={settingOpening}
          submitting={openingMutation.isPending}
          error={
            openingMutation.isError
              ? openingMutation.error instanceof ApiError
                ? openingMutation.error.message
                : 'Couldn’t save the starting balance. Please try again.'
              : null
          }
          onSubmit={(values) => openingMutation.mutate(values)}
          onOpenChange={(open) => {
            if (!open) {
              openingMutation.reset();
              setSettingOpening(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}
