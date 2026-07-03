'use client';

import type { Account, Transaction } from '@/lib/api/types';
import { formatMoney, transactionKindLabel } from '@/lib/money';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Confirms a HARD delete (the API removes the row permanently).
export function DeleteTransactionDialog({
  tx,
  accountsById,
  deleting,
  error,
  onConfirm,
  onOpenChange,
}: {
  tx: Transaction | null;
  accountsById: Map<string, Account>;
  deleting: boolean;
  error: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const account = tx ? accountsById.get(tx.accountId) : null;

  return (
    <Dialog open={tx !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this transaction?</DialogTitle>
          <DialogDescription>
            This permanently removes the record and updates your balances. It
            can’t be undone.
          </DialogDescription>
        </DialogHeader>

        {tx ? (
          <div className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span>
                {transactionKindLabel(tx.kind)}
                {account ? ` · ${account.name}` : ''}
              </span>
              <span className="num tabular-nums">{formatMoney(tx.amount)}</span>
            </div>
            {tx.note ? (
              <p className="mt-1 text-muted-foreground">{tx.note}</p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-[color:var(--neg)]" role="alert">
            Couldn’t delete it — please try again.
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
