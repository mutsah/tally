import { nestFetch } from '@/lib/api/nest-fetch';
import type {
  Account,
  Category,
  PaginatedTransactions,
} from '@/lib/api/types';
import { TransactionsView } from '@/components/transactions/transactions-view';

// Server component: seeds the list, accounts, and categories through the F1
// session (money stays a string). SSR reads don't refresh cookies — the client
// queries (via the BFF) handle a 401 on refresh.
export default async function TransactionsPage() {
  const [txRes, accRes, catRes] = await Promise.all([
    nestFetch('/transactions?page=1&pageSize=20'),
    nestFetch('/accounts'),
    nestFetch('/categories'),
  ]);

  return (
    <TransactionsView
      initialTransactions={
        txRes.status === 200 ? (txRes.data as PaginatedTransactions) : null
      }
      initialAccounts={
        accRes.status === 200 ? (accRes.data as Account[]) : null
      }
      initialCategories={
        catRes.status === 200 ? (catRes.data as Category[]) : null
      }
    />
  );
}
