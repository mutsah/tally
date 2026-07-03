'use client';

import type { Account, Category, TransactionKind } from '@/lib/api/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { transactionKindLabel } from '@/lib/money';

// `kind` is now a real server-side filter (GET /transactions?kind=…). The empty
// string means "all"; Radix Select can't use "" as an item value, so the UI maps
// to/from the ALL sentinel.
export interface FilterState {
  accountId: string;
  categoryId: string;
  kind: '' | TransactionKind;
  from: string; // yyyy-mm-dd
  to: string; // yyyy-mm-dd
}

export const EMPTY_FILTERS: FilterState = {
  accountId: '',
  categoryId: '',
  kind: '',
  from: '',
  to: '',
};

const ALL = '__all__';
const KINDS: TransactionKind[] = ['INCOME', 'EXPENSE', 'TRANSFER', 'OPENING'];

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-40 flex-1 flex-col gap-1 font-mono text-xs text-faint">
      {label}
      {children}
    </label>
  );
}

export function TransactionFilters({
  filters,
  accounts,
  categories,
  onChange,
  onClear,
}: {
  filters: FilterState;
  accounts: Account[];
  categories: Category[];
  onChange: (next: FilterState) => void;
  onClear: () => void;
}) {
  const set = (patch: Partial<FilterState>) =>
    onChange({ ...filters, ...patch });

  const dirty =
    filters.accountId ||
    filters.categoryId ||
    filters.kind ||
    filters.from ||
    filters.to;

  return (
    // Full-width row, no floating card — left/right edges align with the table.
    <div className="flex w-full flex-wrap items-end gap-3">
      <Field label="Account">
        <Select
          value={filters.accountId || ALL}
          onValueChange={(v) => set({ accountId: v === ALL ? '' : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All accounts</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Category">
        <Select
          value={filters.categoryId || ALL}
          onValueChange={(v) => set({ categoryId: v === ALL ? '' : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.parentId ? `— ${c.name}` : c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Kind">
        <Select
          value={filters.kind || ALL}
          onValueChange={(v) =>
            set({ kind: v === ALL ? '' : (v as TransactionKind) })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All kinds</SelectItem>
            {KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {transactionKindLabel(k)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="From">
        <Input
          type="date"
          value={filters.from}
          onChange={(e) => set({ from: e.target.value })}
        />
      </Field>

      <Field label="To">
        <Input
          type="date"
          value={filters.to}
          onChange={(e) => set({ to: e.target.value })}
        />
      </Field>

      {dirty ? (
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      ) : null}
    </div>
  );
}
