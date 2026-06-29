import { CategoryKind } from '@prisma/client';

/**
 * Starter categories seeded for every new user at signup (all top-level, no
 * nesting). One reusable source of truth — used by the register flow and its
 * test. 10 expense + 4 income = 14.
 */
export const STARTER_CATEGORIES: ReadonlyArray<{
  name: string;
  kind: CategoryKind;
}> = [
  { name: 'Rent', kind: CategoryKind.EXPENSE },
  { name: 'Groceries', kind: CategoryKind.EXPENSE },
  { name: 'Transport', kind: CategoryKind.EXPENSE },
  { name: 'Eating out', kind: CategoryKind.EXPENSE },
  { name: 'Utilities', kind: CategoryKind.EXPENSE },
  { name: 'Data & airtime', kind: CategoryKind.EXPENSE },
  { name: 'Shopping', kind: CategoryKind.EXPENSE },
  { name: 'Health', kind: CategoryKind.EXPENSE },
  { name: 'Entertainment', kind: CategoryKind.EXPENSE },
  { name: 'Other', kind: CategoryKind.EXPENSE },
  { name: 'Salary', kind: CategoryKind.INCOME },
  { name: 'Freelance', kind: CategoryKind.INCOME },
  { name: 'Loan interest', kind: CategoryKind.INCOME },
  { name: 'Gifts', kind: CategoryKind.INCOME },
];
