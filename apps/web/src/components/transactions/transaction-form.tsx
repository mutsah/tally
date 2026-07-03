'use client';

import { useMemo, useState } from 'react';
import type {
  Account,
  Category,
  TransactionKind,
} from '@/lib/api/types';
import { transactionKindLabel } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MoneyInput } from './money-input';
import { cn } from '@/lib/utils';

// The form's normalised output. Parents map it to a NewTransaction (create) or a
// TransactionPatch (edit). Money (`amount`) is a string throughout.
export interface TransactionFormValues {
  kind: TransactionKind;
  amount: string;
  date: string; // ISO 8601
  accountId: string;
  categoryId: string | null;
  toAccountId: string | null;
  note: string | null;
}

const CREATE_KINDS: TransactionKind[] = ['EXPENSE', 'INCOME', 'TRANSFER'];
const MONEY_RE = /^\d+(\.\d{1,2})?$/;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-xs text-faint">{label}</label>
      {children}
    </div>
  );
}

export function TransactionForm({
  accounts,
  categories,
  fixedKind,
  initial,
  submitting,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  accounts: Account[];
  categories: Category[];
  fixedKind?: TransactionKind; // edit: kind is immutable
  initial?: Partial<TransactionFormValues>;
  submitting: boolean;
  error: boolean;
  submitLabel: string;
  onSubmit: (values: TransactionFormValues) => void;
  onCancel: () => void;
}) {
  const isEdit = fixedKind !== undefined;
  const [kind, setKind] = useState<TransactionKind>(
    fixedKind ?? initial?.kind ?? 'EXPENSE',
  );
  const [amount, setAmount] = useState(initial?.amount ?? '');
  const [date, setDate] = useState(
    initial?.date ? initial.date.slice(0, 10) : todayIso(),
  );
  const [accountId, setAccountId] = useState(initial?.accountId ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [toAccountId, setToAccountId] = useState(initial?.toAccountId ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [localError, setLocalError] = useState<string | null>(null);

  const openAccounts = useMemo(
    () => accounts.filter((a) => !a.archived),
    [accounts],
  );
  // Categories whose kind matches the transaction (income vs expense).
  const kindCategories = useMemo(() => {
    if (kind !== 'INCOME' && kind !== 'EXPENSE') return [];
    return categories.filter((c) => c.kind === kind);
  }, [categories, kind]);

  const isTransfer = kind === 'TRANSFER';
  const isCategorised = kind === 'INCOME' || kind === 'EXPENSE';

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!MONEY_RE.test(amount) || !/[1-9]/.test(amount)) {
      setLocalError('Enter an amount greater than 0 (e.g. 12.50).');
      return;
    }
    if (!accountId) {
      setLocalError('Choose an account.');
      return;
    }
    if (isCategorised && !categoryId) {
      setLocalError('Choose a category.');
      return;
    }
    if (isTransfer) {
      if (!toAccountId) {
        setLocalError('Choose a destination account.');
        return;
      }
      if (toAccountId === accountId) {
        setLocalError('Source and destination must be different accounts.');
        return;
      }
    }
    setLocalError(null);
    onSubmit({
      kind,
      amount,
      date: new Date(date).toISOString(),
      accountId,
      categoryId: isCategorised ? categoryId : null,
      toAccountId: isTransfer ? toAccountId : null,
      note: note.trim() || null,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {!isEdit ? (
        <div className="flex gap-2">
          {CREATE_KINDS.map((k) => {
            const selected = kind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  'flex-1 rounded-md border px-3 py-1.5 text-sm transition-colors',
                  selected
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : 'border-input bg-surface-2 hover:bg-secondary',
                )}
              >
                {transactionKindLabel(k)}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="font-mono text-xs text-faint">
          {transactionKindLabel(kind)} · type is fixed after creation
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount">
          <MoneyInput value={amount} onChange={setAmount} autoFocus />
        </Field>
        <Field label="Date">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>

      <Field label={isTransfer ? 'From account' : 'Account'}>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger>
            <SelectValue placeholder="Select an account…" />
          </SelectTrigger>
          <SelectContent>
            {openAccounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {isTransfer ? (
        <Field label="To account">
          <Select value={toAccountId} onValueChange={setToAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a destination…" />
            </SelectTrigger>
            <SelectContent>
              {openAccounts
                .filter((a) => a.id !== accountId)
                .map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      {isCategorised ? (
        <Field label="Category">
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a category…" />
            </SelectTrigger>
            <SelectContent>
              {kindCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.parentId ? `— ${c.name}` : c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {kindCategories.length === 0 ? (
            <p className="font-mono text-xs text-faint">
              No {transactionKindLabel(kind).toLowerCase()} categories yet — add
              one under Categories.
            </p>
          ) : null}
        </Field>
      ) : null}

      <Field label="Note (optional)">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={280}
          placeholder="What was it for?"
        />
      </Field>

      {localError || error ? (
        <p className="text-sm text-[color:var(--neg)]" role="alert">
          {localError ?? 'Couldn’t save. Please check the details and try again.'}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
