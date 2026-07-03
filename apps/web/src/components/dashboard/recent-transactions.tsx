import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { RecentTransaction, TransactionKind } from '@/lib/api/types';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

const SIGN: Record<TransactionKind, { sign: string; tone: string }> = {
  INCOME: { sign: '+', tone: 'text-[color:var(--pos)]' },
  EXPENSE: { sign: '−', tone: 'text-[color:var(--neg)]' },
  TRANSFER: { sign: '', tone: 'text-muted-foreground' },
  OPENING: { sign: '+', tone: 'text-[color:var(--gold)]' },
};

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
function shortDate(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

function title(tx: RecentTransaction): string {
  if (tx.note) return tx.note;
  if (tx.kind === 'TRANSFER') return `To ${tx.toAccount?.name ?? 'account'}`;
  if (tx.category) return tx.category.name;
  return tx.account?.name ?? 'Transaction';
}

function subtitle(tx: RecentTransaction): string {
  const parts = [shortDate(tx.date)];
  if (tx.account) parts.push(tx.account.name);
  if (tx.kind === 'TRANSFER') parts.push('transfer');
  else if (tx.category) parts.push(tx.category.name);
  return parts.join(' · ');
}

export function RecentTransactions({
  transactions,
}: {
  transactions: RecentTransaction[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-tally">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">
          Recent transactions
        </h2>
        <Link
          href="/transactions"
          className="font-mono text-xs text-[color:var(--gold)] hover:underline"
        >
          View all
        </Link>
      </div>

      {transactions.length === 0 ? (
        <p className="px-2 py-8 text-center text-sm text-faint">
          No transactions yet.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {transactions.map((tx) => {
            const tone = SIGN[tx.kind];
            return (
              <li
                key={tx.id}
                className="flex items-center gap-3 py-2.5"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-xs text-pine">
                  {tx.kind === 'TRANSFER' ? (
                    <ArrowRight className="size-4 text-faint" />
                  ) : (
                    title(tx).charAt(0).toUpperCase()
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{title(tx)}</p>
                  <p className="truncate font-mono text-xs text-faint">
                    {subtitle(tx)}
                  </p>
                </div>
                <span
                  className={cn('num shrink-0 text-sm tabular-nums', tone.tone)}
                >
                  {tone.sign}
                  {formatMoney(tx.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
