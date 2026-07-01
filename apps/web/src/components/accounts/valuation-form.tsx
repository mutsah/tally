'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { NewValuation } from '@/lib/api/types';
import { recordValuation } from '@/lib/accounts/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Snapshot entry for valued accounts (INVESTMENT / MICROLOANS). `value` is kept
// as a string and validated against the API's shape (digits, ≤ 2 decimals) —
// never parsed to a float. `asOf` is sent as an ISO date.
const MONEY_RE = /^\d+(\.\d{1,2})?$/;

export function ValuationForm({
  accountId,
  onDone,
}: {
  accountId: string;
  onDone: () => Promise<unknown>;
}) {
  const [value, setValue] = useState('');
  const [asOf, setAsOf] = useState('');
  const [note, setNote] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: NewValuation) => recordValuation(input),
    onSuccess: async () => {
      await onDone();
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!MONEY_RE.test(value)) {
      setLocalError('Enter a value like 1200 or 1200.50.');
      return;
    }
    if (!asOf) {
      setLocalError('Pick the date this value is as of.');
      return;
    }
    setLocalError(null);
    mutation.mutate({
      accountId,
      value,
      asOf: new Date(asOf).toISOString(),
      note: note.trim() || undefined,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-40"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0.00"
        />
        <Input
          className="max-w-44"
          type="date"
          value={asOf}
          onChange={(e) => setAsOf(e.target.value)}
        />
      </div>
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
      />

      {localError || mutation.isError ? (
        <p className="text-sm text-[color:var(--neg)]" role="alert">
          {localError ?? 'Couldn’t save the valuation. Please try again.'}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save value'}
        </Button>
      </div>
    </form>
  );
}
