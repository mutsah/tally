'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { NetWorthAccount, Valuation } from '@/lib/api/types';
import { formatMoney } from '@/lib/money';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ValuationForm } from '@/components/accounts/valuation-form';
import { cn } from '@/lib/utils';

// Valuation status = a computed fact per valued account: when it was last valued
// and how stale that snapshot is. It states data age, never advice — no tips, no
// "you should…". A row opens the existing snapshot-entry flow (ValuationForm).
const STALE_DAYS = 30;
const MS_PER_DAY = 86_400_000;
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}
function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / MS_PER_DAY);
}

export function ValuationStatusCard({
  accounts,
  valuations,
}: {
  accounts: NetWorthAccount[];
  valuations: Valuation[];
}) {
  const qc = useQueryClient();
  const [openAccount, setOpenAccount] = useState<NetWorthAccount | null>(null);

  // Valuations arrive asOf desc, so the first hit per account is the latest.
  const latestByAccount = new Map<string, Valuation>();
  for (const v of valuations) {
    if (!latestByAccount.has(v.accountId)) latestByAccount.set(v.accountId, v);
  }

  async function onValued() {
    // A snapshot changes the account balance → refresh accounts, dashboard, and
    // the valuations list feeding this card.
    await Promise.all(
      [['accounts'], ['dashboard'], ['valuations']].map((key) =>
        qc.invalidateQueries({ queryKey: key }),
      ),
    );
    setOpenAccount(null);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-tally">
      <h2 className="mb-2 font-display text-lg font-semibold">
        Valuation status
      </h2>
      <ul className="divide-y divide-border">
        {accounts.map((a) => {
          const latest = latestByAccount.get(a.accountId);
          const age = latest ? daysAgo(latest.asOf) : null;
          const stale = age === null || age > STALE_DAYS;
          return (
            <li key={a.accountId}>
              <button
                type="button"
                onClick={() => setOpenAccount(a)}
                className="-mx-2 flex w-full items-center justify-between gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-surface-2/60"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.name}</p>
                  <p
                    className={cn(
                      'flex items-center gap-1.5 font-mono text-xs',
                      stale ? 'text-[color:var(--gold)]' : 'text-faint',
                    )}
                  >
                    {stale ? (
                      <span
                        aria-hidden
                        className="inline-block size-1.5 rounded-full bg-[color:var(--gold)]"
                      />
                    ) : null}
                    {latest
                      ? stale
                        ? `Last valued ${age} days ago`
                        : `Last valued ${formatDate(latest.asOf)}`
                      : 'Not valued yet'}
                  </p>
                </div>
                <span className="num shrink-0 text-sm tabular-nums">
                  {formatMoney(a.balance)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Dialog
        open={openAccount !== null}
        onOpenChange={(open) => {
          if (!open) setOpenAccount(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record value</DialogTitle>
            <DialogDescription>
              Snapshot the current value of {openAccount?.name}. Its balance
              tracks the latest snapshot.
            </DialogDescription>
          </DialogHeader>
          {openAccount ? (
            <ValuationForm accountId={openAccount.accountId} onDone={onValued} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
