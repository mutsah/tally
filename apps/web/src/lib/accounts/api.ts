import type {
  Account,
  AccountPatch,
  NewAccount,
  NewValuation,
  Valuation,
} from '@/lib/api/types';

/**
 * Client-side accounts API — calls the same-origin BFF route handlers (which
 * forward the session token to Nest). Money stays a string end to end.
 */
export class ApiError extends Error {
  constructor(public readonly status: number) {
    super(`request failed: ${status}`);
    this.name = 'ApiError';
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) throw new ApiError(res.status);
  return res.json() as Promise<T>;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export function fetchAccounts(): Promise<Account[]> {
  return fetch('/api/accounts', { cache: 'no-store' }).then(parse<Account[]>);
}

export function createAccount(input: NewAccount): Promise<Account> {
  return fetch('/api/accounts', jsonInit('POST', input)).then(parse<Account>);
}

export function updateAccount(id: string, patch: AccountPatch): Promise<Account> {
  return fetch(`/api/accounts/${id}`, jsonInit('PATCH', patch)).then(
    parse<Account>,
  );
}

export function recordValuation(input: NewValuation): Promise<unknown> {
  return fetch('/api/valuations', jsonInit('POST', input)).then(parse<unknown>);
}

/** All the user's valuation snapshots (asOf desc) — for last-valued dates. */
export function fetchValuations(): Promise<Valuation[]> {
  return fetch('/api/valuations', { cache: 'no-store' }).then(
    parse<Valuation[]>,
  );
}
