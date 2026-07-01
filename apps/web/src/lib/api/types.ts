/**
 * Shared API types. Money is ALWAYS a string on the wire and stays a string in
 * the client — mirroring the backend's Decimal-as-string format. It is never
 * parsed into a JS number (floats lose precision). Format for display; compute,
 * if ever needed, with a decimal library — never `Number(amount)`.
 */
export type Money = string;

export type AccountType = 'CASH' | 'BANK' | 'INVESTMENT' | 'MICROLOANS';

// GET /accounts shape — the computed `balance` is a string (derived from
// transaction flow for CASH/BANK, from the latest valuation for INVESTMENT/
// MICROLOANS). POST/PATCH responses omit `balance`.
export interface Account {
  id: string;
  name: string;
  type: AccountType;
  archived: boolean;
  balance: Money; // e.g. "1250.00"
}

export interface NewAccount {
  name: string;
  type: AccountType;
}

export interface AccountPatch {
  name?: string;
  archived?: boolean;
}

export interface NewValuation {
  accountId: string;
  value: Money; // string, ≥ 0, ≤ 2 decimals
  asOf: string; // ISO 8601
  note?: string;
}
