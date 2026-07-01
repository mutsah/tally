import { apiFetch } from './client';
import type { Account } from './types';

/**
 * One typed call, to prove the client shape (F0). Not consumed anywhere yet —
 * the accounts feature (F2) wires it into TanStack Query. `balance` comes back
 * as a string and stays one.
 */
export function listAccounts(): Promise<Account[]> {
  return apiFetch<Account[]>('/accounts');
}
