import { nestFetch } from '@/lib/api/nest-fetch';
import type { Account, Category } from '@/lib/api/types';
import { ExportView } from '@/components/export/export-view';

// Server component: seeds the accounts + categories that populate the export
// filter dropdowns through the F1 session. The export download itself runs
// client-side against the BFF.
export default async function ExportPage() {
  const [accRes, catRes] = await Promise.all([
    nestFetch('/accounts'),
    nestFetch('/categories'),
  ]);

  return (
    <ExportView
      initialAccounts={accRes.status === 200 ? (accRes.data as Account[]) : null}
      initialCategories={
        catRes.status === 200 ? (catRes.data as Category[]) : null
      }
    />
  );
}
