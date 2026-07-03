import type { NetWorth } from '@/lib/api/types';
import { MoneyFigure } from './money-figure';

// Pine feature card — the headline net-worth figure (JetBrains Mono). No
// vs-last-month tag: the API returns no period comparison, so none is invented.
export function NetWorthCard({ netWorth }: { netWorth: NetWorth }) {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius)] bg-pine p-6 text-[color:var(--surface)] shadow-tally">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(169,128,47,0.22), transparent 70%)',
        }}
      />
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-white/60">
        Net worth
      </p>
      <MoneyFigure
        value={netWorth.total}
        className="mt-2 block font-display text-4xl font-semibold"
        centsClassName="text-2xl"
      />
      <p className="mt-2 text-sm text-white/60">
        Across {netWorth.accounts.length} account
        {netWorth.accounts.length === 1 ? '' : 's'}, derived and valued combined.
      </p>
    </div>
  );
}
