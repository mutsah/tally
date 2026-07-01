'use client';

import { useState } from 'react';
import type { AccountType, NewAccount } from '@/lib/api/types';
import { accountKindLabel, isValuedAccount } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const KINDS: AccountType[] = ['CASH', 'BANK', 'INVESTMENT', 'MICROLOANS'];

// One form for both create and edit. On edit the type is immutable (the API
// omits `type` from the update DTO), so `lockedType` fixes it and hides the
// selector's interactivity.
export function AccountForm({
  initialName = '',
  lockedType,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  initialName?: string;
  lockedType?: AccountType;
  submitting: boolean;
  error: boolean;
  onSubmit: (input: NewAccount) => void;
  onCancel: () => void;
}) {
  const isEdit = lockedType !== undefined;
  const [name, setName] = useState(initialName);
  const [type, setType] = useState<AccountType>(lockedType ?? 'BANK');
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setLocalError('Give the account a name.');
      return;
    }
    setLocalError(null);
    onSubmit({ name: name.trim(), type });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-xs text-faint">Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Chase Checking"
          maxLength={100}
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-xs text-faint">
          Type {isEdit ? '(fixed after creation)' : null}
        </label>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => {
            const selected = type === k;
            const disabled = isEdit && k !== lockedType;
            return (
              <button
                key={k}
                type="button"
                disabled={isEdit}
                onClick={() => setType(k)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm transition-colors',
                  selected
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : 'border-input bg-surface-2 hover:bg-secondary',
                  disabled ? 'opacity-40' : '',
                )}
              >
                {accountKindLabel(k)}
              </button>
            );
          })}
        </div>
        <p className="font-mono text-xs text-faint">
          {isValuedAccount(type)
            ? 'Balance comes from valuation snapshots you record.'
            : 'Balance is derived from this account’s transactions.'}
        </p>
      </div>

      {localError || error ? (
        <p className="text-sm text-[color:var(--neg)]" role="alert">
          {localError ?? 'Couldn’t save the account. Please try again.'}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : isEdit ? 'Save' : 'Create account'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
