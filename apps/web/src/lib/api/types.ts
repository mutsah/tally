/**
 * Shared API types. Money is ALWAYS a string on the wire and stays a string in
 * the client — mirroring the backend's Decimal-as-string format. It is never
 * parsed into a JS number (floats lose precision). Format for display; compute,
 * if ever needed, with a decimal library — never `Number(amount)`.
 */
export type Money = string;

export type AccountType = 'CASH' | 'BANK' | 'INVESTMENT' | 'MICROLOANS';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  archived: boolean;
  balance: Money; // e.g. "1250.00"
}
