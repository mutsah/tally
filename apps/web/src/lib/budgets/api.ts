import type { Budget, BudgetPatch, NewBudget } from '@/lib/api/types';
import { jsonInit, parseJson } from '@/lib/api/http';

/**
 * Client-side budgets API — calls the same-origin BFF, which forwards the
 * session token to Nest. `amount` stays a string end to end (never coerced to a
 * number): it is sent raw and displayed via formatMoney.
 */

/** The signed-in user's budgets, via the BFF. */
export function fetchBudgets(): Promise<Budget[]> {
  return fetch('/api/budgets', { cache: 'no-store' }).then(
    parseJson<Budget[]>,
  );
}

export function createBudget(input: NewBudget): Promise<Budget> {
  return fetch('/api/budgets', jsonInit('POST', input)).then(
    parseJson<Budget>,
  );
}

export function updateBudget(id: string, patch: BudgetPatch): Promise<Budget> {
  return fetch(`/api/budgets/${id}`, jsonInit('PATCH', patch)).then(
    parseJson<Budget>,
  );
}

export function deleteBudget(id: string): Promise<Budget> {
  return fetch(`/api/budgets/${id}`, { method: 'DELETE' }).then(
    parseJson<Budget>,
  );
}
