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
