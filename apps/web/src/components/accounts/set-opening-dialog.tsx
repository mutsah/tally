'use client';

import { useState } from 'react';
import type { Account } from '@/lib/api/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { OpeningBalanceFields } from './opening-balance-fields';

const MONEY_RE = /^\d+(\.\d{1,2})?$/;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Set an account's starting balance after the fact (CASH/BANK with no
// transactions yet). The parent owns the mutation; if the account gained
// activity in a race, the backend rejects and `error` carries its message.
export function SetOpeningDialog({
  account,
  open,
  submitting,
  error,
  onSubmit,
  onOpenChange,
}: {
  account: Account;
  open: boolean;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: { amount: string; date: string }) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!MONEY_RE.test(amount) || !/[1-9]/.test(amount)) {
      setLocalError('Enter a balance greater than 0 (e.g. 1200.00).');
      return;
    }
    setLocalError(null);
    onSubmit({ amount, date: new Date(date).toISOString() });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set starting balance</DialogTitle>
          <DialogDescription>
            Record what {account.name} already holds. This is set once.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <OpeningBalanceFields
            amount={amount}
            onAmountChange={setAmount}
            date={date}
            onDateChange={setDate}
            help="The money already in this account today — added as an opening entry."
          />

          {localError || error ? (
            <p className="text-sm text-[color:var(--neg)]" role="alert">
              {localError ?? error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Set balance'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
