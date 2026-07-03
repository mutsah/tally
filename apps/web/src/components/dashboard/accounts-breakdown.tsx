import Link from 'next/link';
import type { AccountType, NetWorthAccount } from '@/lib/api/types';
import { accountKindLabel, isValuedAccount } from '@/lib/money';
import { MoneyFigure } from './money-figure';

// Per-account balances behind net worth. Derived accounts read "· derived";
// valued accounts read "· snapshot" (or "· principal" for microloans), matching
// the mock's treatment.
function meta(type: AccountType): string {
  if (!isValuedAccount(type)) return `${accountKindLabel(type)} · derived`;
  return type === 'MICROLOANS' ? 'Valued · principal' : 'Valued · snapshot';
}

export function AccountsBreakdown({
  accounts,
}: {
  accounts: NetWorthAccount[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-tally">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Accounts</h2>
        <Link
          href="/accounts"
          className="font-mono text-xs text-[color:var(--gold)] hover:underline"
        >
          View all
        </Link>
      </div>
      {accounts.length === 0 ? (
        <p className="px-2 py-6 text-center text-sm text-faint">
          No accounts yet.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {accounts.map((a) => (
            <li
              key={a.accountId}
              className="flex items-center justify-between gap-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{a.name}</p>
                <p className="font-mono text-xs text-faint">{meta(a.type)}</p>
              </div>
              <MoneyFigure value={a.balance} className="text-sm" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
