import { nestFetch } from '@/lib/api/nest-fetch';
import type { Budget, Category } from '@/lib/api/types';
import { BudgetsView } from '@/components/budgets/budgets-view';

// Server component: seeds the expense categories + their budgets through the F1
// session. SSR reads don't refresh cookies — the client queries (via the BFF)
// handle a 401 refresh.
export default async function BudgetsPage() {
  const [categories, budgets] = await Promise.all([
    nestFetch('/categories'),
    nestFetch('/budgets'),
  ]);

  return (
    <BudgetsView
      initialCategories={
        categories.status === 200 ? (categories.data as Category[]) : null
      }
      initialBudgets={budgets.status === 200 ? (budgets.data as Budget[]) : null}
    />
  );
}
