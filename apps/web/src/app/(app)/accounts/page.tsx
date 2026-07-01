import { nestFetch } from '@/lib/api/nest-fetch';
import type { Account } from '@/lib/api/types';
import { AccountsView } from '@/components/accounts/accounts-view';

// Server component: reads the account list through the F1 session (access token
// forwarded to Nest, money stays a string). A render can't rotate cookies, so
// SSR reads don't refresh — the client query (via the BFF) handles that on 401.
export default async function AccountsPage() {
  const { status, data } = await nestFetch('/accounts');
  const initialAccounts = status === 200 ? (data as Account[]) : null;

  return <AccountsView initialAccounts={initialAccounts} />;
}
