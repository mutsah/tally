import type { AccountType, TransactionKind } from '@/lib/api/types';

const VALUED: readonly AccountType[] = ['INVESTMENT', 'MICROLOANS'];

/** Valued accounts (INVESTMENT/MICROLOANS) take their balance from the latest
 *  valuation snapshot, not transaction flow. */
export function isValuedAccount(type: AccountType): boolean {
  return VALUED.includes(type);
}

const KIND_LABEL: Record<AccountType, string> = {
  CASH: 'Cash',
  BANK: 'Bank',
  INVESTMENT: 'Investment',
  MICROLOANS: 'Microloans',
};

export function accountKindLabel(type: AccountType): string {
  return KIND_LABEL[type];
}

const TX_KIND_LABEL: Record<TransactionKind, string> = {
  INCOME: 'Income',
  EXPENSE: 'Expense',
  TRANSFER: 'Transfer',
  OPENING: 'Opening',
};

export function transactionKindLabel(kind: TransactionKind): string {
  return TX_KIND_LABEL[kind];
}

/**
 * Convert a money STRING to an integer number of cents. Used ONLY to compute
 * display ratios (donut proportions, savings rate) — never to display money,
 * which always stays a string. Integer cents avoid floating-point money error.
 */
export function moneyToCents(value: string): number {
  const negative = value.startsWith('-');
  const abs = negative ? value.slice(1) : value;
  const [intPart, decRaw = ''] = abs.split('.');
  const cents = Number(intPart) * 100 + Number(`${decRaw}00`.slice(0, 2));
  return negative ? -cents : cents;
}

/** part / whole as a whole-number percent (0 when whole is 0). For display. */
export function percentOf(part: string, whole: string): number {
  const wholeCents = moneyToCents(whole);
  if (wholeCents === 0) return 0;
  return Math.round((moneyToCents(part) / wholeCents) * 100);
}

/**
 * Format a decimal money STRING for display. Purely string-based (group the
 * integer part, keep two decimals) — money is never parsed to a float.
 */
export function formatMoney(value: string): string {
  const negative = value.startsWith('-');
  const abs = negative ? value.slice(1) : value;
  const [intPart, decRaw = ''] = abs.split('.');
  const dec = decRaw.padEnd(2, '0').slice(0, 2);
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}$${grouped}.${dec}`;
}
