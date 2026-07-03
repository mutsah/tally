'use client';

import { useMemo, useState } from 'react';
import type { Category, CategoryKind } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface CategoryFormValues {
  name: string;
  kind: CategoryKind;
  parentId: string | null; // null = top-level
}

const KINDS: CategoryKind[] = ['EXPENSE', 'INCOME'];
const KIND_LABEL: Record<CategoryKind, string> = {
  INCOME: 'Income',
  EXPENSE: 'Expense',
};
// Radix Select can't use "" as an item value; this sentinel is the real,
// selectable "no parent / top-level" option.
const NONE = '__none__';

export function CategoryForm({
  categories,
  fixedKind,
  hasChildren = false,
  initial,
  submitting,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  categories: Category[];
  fixedKind?: CategoryKind; // edit: kind is immutable
  hasChildren?: boolean; // edit: a category with children must stay top-level
  initial?: Partial<CategoryFormValues> & { id?: string };
  submitting: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: (values: CategoryFormValues) => void;
  onCancel: () => void;
}) {
  const isEdit = fixedKind !== undefined;
  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<CategoryKind>(
    fixedKind ?? initial?.kind ?? 'EXPENSE',
  );
  const [parentId, setParentId] = useState<string | null>(
    initial?.parentId ?? null,
  );
  const [localError, setLocalError] = useState<string | null>(null);

  // Valid parents: top-level, same kind, and not the category itself. One level
  // only — children never appear here, so a child can't become a parent.
  const parentOptions = useMemo(
    () =>
      categories.filter(
        (c) =>
          c.parentId === null && c.kind === kind && c.id !== initial?.id,
      ),
    [categories, kind, initial?.id],
  );

  // A category that already has children can't itself be nested (backend rule).
  const parentLocked = hasChildren;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setLocalError('Give the category a name.');
      return;
    }
    setLocalError(null);
    onSubmit({
      name: name.trim(),
      kind,
      parentId: parentLocked ? null : parentId,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-xs text-faint">Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Groceries"
          maxLength={100}
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-xs text-faint">
          Kind {isEdit ? '(fixed after creation)' : null}
        </label>
        {isEdit ? (
          <p className="font-mono text-sm">{KIND_LABEL[kind]}</p>
        ) : (
          <div className="flex gap-2">
            {KINDS.map((k) => {
              const selected = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setKind(k);
                    setParentId(null); // valid parents differ by kind
                  }}
                  className={cn(
                    'flex-1 rounded-md border px-3 py-1.5 text-sm transition-colors',
                    selected
                      ? 'border-transparent bg-primary text-primary-foreground'
                      : 'border-input bg-surface-2 hover:bg-secondary',
                  )}
                >
                  {KIND_LABEL[k]}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-xs text-faint">Parent (optional)</label>
        <Select
          value={parentId ?? NONE}
          onValueChange={(v) => setParentId(v === NONE ? null : v)}
          disabled={parentLocked}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>None (top-level)</SelectItem>
            {parentOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="font-mono text-xs text-faint">
          {parentLocked
            ? 'This category has children, so it must stay top-level.'
            : `Only top-level ${KIND_LABEL[kind].toLowerCase()} categories can be parents — one level of nesting.`}
        </p>
      </div>

      {localError || error ? (
        <p className="text-sm text-[color:var(--neg)]" role="alert">
          {localError ?? error}
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
