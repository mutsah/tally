'use client';

import { ArrowRight, Pencil, Trash2 } from 'lucide-react';
import type { Account, Category, Transaction, TransactionKind } from '@/lib/api/types';
import { formatMoney, transactionKindLabel } from '@/lib/money';
import { cn } from '@/lib/utils';

// Kind → visual treatment (color coding per the dashboard mock). Amount sign is
// prepended to the money STRING — never a numeric negation.
const KIND_TONE: Record<
  TransactionKind,
  { pill: string; amount: string; sign: string }
> = {
  INCOME: {
    pill: 'bg-[color:var(--pos-bg)] text-[color:var(--pos)]',
    amount: 'text-[color:var(--pos)]',
    sign: '+',
  },
  EXPENSE: {
    pill: 'bg-[color:var(--neg-bg)] text-[color:var(--neg)]',
    amount: 'text-[color:var(--neg)]',
    sign: '−',
  },
  TRANSFER: {
    pill: 'bg-surface-2 text-muted-foreground',
    amount: 'text-muted-foreground',
    sign: '',
  },
  OPENING: {
    pill: 'bg-[color:var(--gold-bg)] text-[color:var(--gold)]',
    amount: 'text-[color:var(--gold)]',
    sign: '+',
  },
};

function fmtDate(iso: string): string {
  // Locale-stable, string-derived (yyyy-mm-dd → "12 Jun 2026").
  const [y, m, d] = iso.slice(0, 10).split('-');
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
}

export function TransactionTable({
  transactions,
  accountsById,
  categoriesById,
  onEdit,
  onDelete,
}: {
  transactions: Transaction[];
  accountsById: Map<string, Account>;
  categoriesById: Map<string, Category>;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-tally">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left font-mono text-xs uppercase tracking-wide text-faint">
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Description</th>
            <th className="px-4 py-3 font-medium">Account</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 text-right font-medium">Amount</th>
            <th className="px-4 py-3" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const tone = KIND_TONE[tx.kind];
            const account = accountsById.get(tx.accountId);
            const toAccount = tx.toAccountId
              ? accountsById.get(tx.toAccountId)
              : null;
            const category = tx.categoryId
              ? categoriesById.get(tx.categoryId)
              : null;
            return (
              <tr
                key={tx.id}
                className="group border-b border-border last:border-0 hover:bg-surface-2/60"
              >
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                  {fmtDate(tx.date)}
                </td>
                <td className="px-4 py-3">
                  {tx.note || (
                    <span className="text-faint">
                      {transactionKindLabel(tx.kind)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {tx.kind === 'TRANSFER' ? (
                    <span className="flex items-center gap-1.5">
                      {account?.name ?? '—'}
                      <ArrowRight className="size-3 text-faint" />
                      {toAccount?.name ?? '—'}
                    </span>
                  ) : (
                    (account?.name ?? '—')
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      tone.pill,
                    )}
                  >
                    {transactionKindLabel(tx.kind)}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {category?.name ?? <span className="text-faint">—</span>}
                </td>
                <td
                  className={cn(
                    'num whitespace-nowrap px-4 py-3 text-right tabular-nums',
                    tone.amount,
                  )}
                >
                  {tone.sign}
                  {formatMoney(tx.amount)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={() => onEdit(tx)}
                      className="rounded p-1.5 text-faint hover:bg-surface-2 hover:text-foreground"
                      aria-label="Edit transaction"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(tx)}
                      className="rounded p-1.5 text-faint hover:bg-[color:var(--neg-bg)] hover:text-[color:var(--neg)]"
                      aria-label="Delete transaction"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
