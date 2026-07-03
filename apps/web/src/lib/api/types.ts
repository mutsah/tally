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

// ── Transactions ──────────────────────────────────────────────────────────────
// NOTE: the API field is `date` (the engineering spec's `occurredAt` never
// shipped). OPENING exists (starting balance for a derived account) though the
// spec's enum omits it — it is set via the account flow, never quick-add.
export type TransactionKind = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'OPENING';

// GET /transactions rows carry IDs only — no joined account/category names — so
// the UI resolves names client-side from the accounts + categories lists.
export interface Transaction {
  id: string;
  kind: TransactionKind;
  amount: Money; // string, e.g. "50.00"
  date: string; // ISO 8601
  note: string | null;
  accountId: string;
  toAccountId: string | null; // TRANSFER only
  categoryId: string | null; // INCOME / EXPENSE only
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedTransactions {
  data: Transaction[];
  page: number;
  pageSize: number;
  total: number;
}

// Create. Per-kind rules the API enforces in one validated path:
//   INCOME / EXPENSE → categoryId required (matching kind), no toAccountId
//   TRANSFER         → toAccountId required (≠ accountId), no categoryId
//   OPENING          → neither; one per account (not created via quick-add)
export interface NewTransaction {
  kind: TransactionKind;
  amount: Money;
  date: string; // ISO 8601
  accountId: string;
  categoryId?: string;
  toAccountId?: string;
  note?: string;
}

// PATCH — kind is immutable (omitted). null clears an optional field.
export interface TransactionPatch {
  amount?: Money;
  date?: string;
  accountId?: string;
  categoryId?: string | null;
  toAccountId?: string | null;
  note?: string | null;
}

// Real GET /transactions query params.
export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  kind?: TransactionKind;
  from?: string; // ISO 8601
  to?: string; // ISO 8601
  page?: number;
  pageSize?: number;
}

// An OPENING transaction records an account's starting balance (CASH/BANK). One
// per account (DB-enforced); no category, no destination.
export interface NewOpeningBalance {
  accountId: string;
  amount: Money;
  date: string; // ISO 8601
}

// ── Categories ────────────────────────────────────────────────────────────────
export type CategoryKind = 'INCOME' | 'EXPENSE';

// GET /categories returns each top-level category immediately followed by its
// children (both alphabetical); children carry `parentId`. Flat — the client
// builds the one-level tree.
export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  parentId: string | null;
}

// Create. Parent (if any) must be top-level, owned, and the SAME kind (API
// enforced). Omit parentId for a top-level category.
export interface NewCategory {
  name: string;
  kind: CategoryKind;
  parentId?: string;
}

// PATCH — kind is immutable (omitted). parentId: omit = unchanged, null =
// promote to top-level, uuid = re-parent under a valid top-level same-kind parent.
export interface CategoryPatch {
  name?: string;
  parentId?: string | null;
}

// ── Dashboard (4 read-only endpoints; all money is strings) ───────────────────
// GET /dashboard/net-worth — non-archived accounts, balance derived (CASH/BANK)
// or from the latest valuation (INVESTMENT/MICROLOANS).
export interface NetWorthAccount {
  accountId: string;
  name: string;
  type: AccountType;
  balance: Money;
}
export interface NetWorth {
  total: Money;
  accounts: NetWorthAccount[];
}

// GET /dashboard/income-vs-expense?from&to — TRANSFER + OPENING excluded.
export interface IncomeVsExpense {
  income: Money;
  expense: Money;
  net: Money;
}

// GET /dashboard/spending-by-category?from&to — EXPENSE only (transfers, income,
// OPENING excluded); parent totals are rolled up SERVER-SIDE (own + children).
// Returns every expense category, including zero-total ones — filter client-side.
export interface CategorySpend {
  categoryId: string;
  name: string;
  total: Money;
}
export interface CategoryRollup extends CategorySpend {
  children: CategorySpend[];
}
export interface SpendingByCategory {
  grandTotal: Money;
  categories: CategoryRollup[];
}

// GET /dashboard/recent-activity?limit — most recent, date desc, ALL kinds
// (transfers and openings included as real activity).
export interface RecentTransaction {
  id: string;
  kind: TransactionKind;
  amount: Money;
  date: string; // ISO 8601
  note: string | null;
  account: { id: string; name: string; type: string } | null;
  toAccount: { id: string; name: string; type: string } | null;
  category: { id: string; name: string; kind: string } | null;
}
