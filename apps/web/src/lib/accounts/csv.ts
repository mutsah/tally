import type { Account } from '@/lib/api/types';
import { toCsv } from '@/lib/csv/to-csv';

/**
 * Build the Accounts CSV (client-side — GET /accounts returns the full list, no
 * pagination). Columns: name, type, archived, balance.
 *   - `balance` is the RAW money string from the API (derived flow for CASH/BANK,
 *     latest valuation snapshot for INVESTMENT/MICROLOANS). It is emitted exactly
 *     — never Number()/toFixed/formatMoney (formatMoney is display-only).
 *   - `type` is emitted straight from the field, so any future account type
 *     passes through without a hardcoded whitelist.
 *   - `archived` is stringified here (the toCsv helper is string-in/string-out).
 */
export function buildAccountsCsv(accounts: Account[]): {
  blob: Blob;
  filename: string;
} {
  const csv = toCsv(accounts, [
    { header: 'name', cell: (a) => a.name },
    { header: 'type', cell: (a) => a.type },
    { header: 'archived', cell: (a) => String(a.archived) },
    { header: 'balance', cell: (a) => a.balance },
  ]);
  const today = new Date().toISOString().slice(0, 10);
  return {
    blob: new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    filename: `accounts-${today}.csv`,
  };
}
