import { Prisma } from '@prisma/client';
import { DashboardService } from './dashboard.service';

// Read-only aggregation. The transaction.groupBy/findMany and category.findMany
// mocks honour where (userId, kind, date range) so transfer/income exclusion and
// userId scoping are genuinely exercised, not assumed. Net worth is driven by a
// mocked AccountsService.findAll (the real balance logic is tested separately).
describe('DashboardService', () => {
  const A = 'user-a';
  const B = 'user-b';
  const D = (s: string) => new Prisma.Decimal(s);
  const dt = (s: string) => new Date(`${s}T00:00:00.000Z`);

  let categories: Array<Record<string, unknown>>;
  let txns: Array<Record<string, unknown>>;
  let accountsById: Record<string, unknown>;
  let categoriesById: Record<string, unknown>;
  let accountsService: { findAll: jest.Mock };
  let prismaMock: {
    category: { findMany: jest.Mock };
    transaction: { groupBy: jest.Mock; findMany: jest.Mock };
  };
  let service: DashboardService;

  const matchTx = (
    t: Record<string, unknown>,
    where: Record<string, unknown>,
  ) => {
    if (t.userId !== where.userId) return false;
    if (where.kind !== undefined) {
      const k = where.kind as { in?: string[] } | string;
      if (typeof k === 'string') {
        if (t.kind !== k) return false;
      } else if (k.in && !k.in.includes(t.kind as string)) {
        return false;
      }
    }
    if (where.date) {
      const range = where.date as { gte?: Date; lte?: Date };
      const d = t.date as Date;
      if (range.gte && d < range.gte) return false;
      if (range.lte && d > range.lte) return false;
    }
    return true;
  };

  beforeEach(() => {
    // Expense categories: parent "Food" with children "Groceries" + "Eating out",
    // plus top-level "Rent". (An income category + a B category must not appear.)
    categories = [
      { id: 'food', userId: A, name: 'Food', kind: 'EXPENSE', parentId: null },
      {
        id: 'groc',
        userId: A,
        name: 'Groceries',
        kind: 'EXPENSE',
        parentId: 'food',
      },
      {
        id: 'eat',
        userId: A,
        name: 'Eating out',
        kind: 'EXPENSE',
        parentId: 'food',
      },
      { id: 'rent', userId: A, name: 'Rent', kind: 'EXPENSE', parentId: null },
      {
        id: 'salary',
        userId: A,
        name: 'Salary',
        kind: 'INCOME',
        parentId: null,
      },
      {
        id: 'bfood',
        userId: B,
        name: 'B Food',
        kind: 'EXPENSE',
        parentId: null,
      },
    ];
    categoriesById = Object.fromEntries(
      categories.map((c) => [c.id, { id: c.id, name: c.name, kind: c.kind }]),
    );
    accountsById = {
      'acc-a': { id: 'acc-a', name: 'Checking', type: 'BANK' },
      'acc-a2': { id: 'acc-a2', name: 'Savings', type: 'BANK' },
    };

    txns = [
      {
        id: 't1',
        userId: A,
        kind: 'EXPENSE',
        amount: D('100.00'),
        date: dt('2026-06-10'),
        accountId: 'acc-a',
        toAccountId: null,
        categoryId: 'food',
      },
      {
        id: 't2',
        userId: A,
        kind: 'EXPENSE',
        amount: D('50.00'),
        date: dt('2026-06-11'),
        accountId: 'acc-a',
        toAccountId: null,
        categoryId: 'groc',
      },
      {
        id: 't3',
        userId: A,
        kind: 'EXPENSE',
        amount: D('30.00'),
        date: dt('2026-06-12'),
        accountId: 'acc-a',
        toAccountId: null,
        categoryId: 'eat',
      },
      {
        id: 't4',
        userId: A,
        kind: 'EXPENSE',
        amount: D('200.00'),
        date: dt('2026-06-13'),
        accountId: 'acc-a',
        toAccountId: null,
        categoryId: 'rent',
      },
      {
        id: 't5',
        userId: A,
        kind: 'INCOME',
        amount: D('1000.00'),
        date: dt('2026-06-14'),
        accountId: 'acc-a',
        toAccountId: null,
        categoryId: 'salary',
      },
      {
        id: 't6',
        userId: A,
        kind: 'TRANSFER',
        amount: D('500.00'),
        date: dt('2026-06-15'),
        accountId: 'acc-a',
        toAccountId: 'acc-a2',
        categoryId: null,
      },
      // Another user's expense — must never appear in A's figures.
      {
        id: 'tb',
        userId: B,
        kind: 'EXPENSE',
        amount: D('9999.00'),
        date: dt('2026-06-10'),
        accountId: 'acc-b',
        toAccountId: null,
        categoryId: 'bfood',
      },
    ];

    accountsService = {
      findAll: jest.fn(async (userId: string) =>
        userId === A
          ? [
              {
                id: 'acc-a',
                name: 'Checking',
                type: 'BANK',
                archived: false,
                balance: '649.50',
              },
              {
                id: 'acc-inv',
                name: 'Brokerage',
                type: 'INVESTMENT',
                archived: false,
                balance: '1500.00',
              },
              {
                id: 'acc-arch',
                name: 'Old',
                type: 'CASH',
                archived: true,
                balance: '100.00',
              },
            ]
          : [],
      ),
    };

    prismaMock = {
      category: {
        findMany: jest.fn(({ where }) =>
          Promise.resolve(
            categories
              .filter((c) => c.userId === where.userId && c.kind === where.kind)
              .map((c) => ({ id: c.id, name: c.name, parentId: c.parentId })),
          ),
        ),
      },
      transaction: {
        groupBy: jest.fn(({ by, where }) => {
          const rows = txns.filter((t) => matchTx(t, where));
          const groups = new Map<string, Record<string, unknown>>();
          for (const t of rows) {
            const key = by.includes('kind')
              ? (t.kind as string)
              : (t.categoryId as string);
            const g =
              groups.get(key) ??
              (by.includes('kind')
                ? { kind: t.kind, _sum: { amount: D('0') } }
                : { categoryId: t.categoryId, _sum: { amount: D('0') } });
            (g._sum as { amount: Prisma.Decimal }).amount = (
              g._sum as { amount: Prisma.Decimal }
            ).amount.plus(t.amount as Prisma.Decimal);
            groups.set(key, g);
          }
          return Promise.resolve([...groups.values()]);
        }),
        findMany: jest.fn(({ where, take }) => {
          let rows = txns.filter((t) => matchTx(t, where));
          rows = [...rows].sort(
            (a, b) => (b.date as Date).getTime() - (a.date as Date).getTime(),
          );
          if (take !== undefined) rows = rows.slice(0, take);
          return Promise.resolve(
            rows.map((t) => ({
              ...t,
              account: accountsById[t.accountId as string] ?? null,
              toAccount: t.toAccountId
                ? (accountsById[t.toAccountId as string] ?? null)
                : null,
              category: t.categoryId
                ? (categoriesById[t.categoryId as string] ?? null)
                : null,
            })),
          );
        }),
      },
    };

    service = new DashboardService(
      prismaMock as never,
      accountsService as never,
    );
  });

  describe('net-worth', () => {
    it('sums non-archived account balances (reusing balance logic, not a transaction re-sum)', async () => {
      const nw = await service.netWorth(A);
      // 649.50 (BANK flow) + 1500.00 (INVESTMENT snapshot) = 2149.50; archived excluded.
      expect(nw.total).toBe('2149.50');
      expect(nw.accounts.map((a) => a.accountId)).toEqual(['acc-a', 'acc-inv']);
      // The valued account's SNAPSHOT value flows in, not its transactions.
      expect(nw.accounts.find((a) => a.accountId === 'acc-inv')?.balance).toBe(
        '1500.00',
      );
      // Net worth must NOT re-sum transactions.
      expect(prismaMock.transaction.groupBy).not.toHaveBeenCalled();
    });

    it('all figures are strings', async () => {
      const nw = await service.netWorth(A);
      expect(typeof nw.total).toBe('string');
      expect(nw.accounts.every((a) => typeof a.balance === 'string')).toBe(
        true,
      );
    });
  });

  describe('spending-by-category', () => {
    it('rolls a parent up to own + children, each child counted once', async () => {
      const res = await service.spendingByCategory(A);
      const food = res.categories.find((c) => c.categoryId === 'food')!;
      // Food: own 100 + groc 50 + eat 30 = 180.00
      expect(food.total).toBe('180.00');
      expect(food.children).toEqual([
        { categoryId: 'groc', name: 'Groceries', total: '50.00' },
        { categoryId: 'eat', name: 'Eating out', total: '30.00' },
      ]);
      const rent = res.categories.find((c) => c.categoryId === 'rent')!;
      expect(rent.total).toBe('200.00');
    });

    it('grand total is the sum of all expense; transfers and income excluded', async () => {
      const res = await service.spendingByCategory(A);
      // 100 + 50 + 30 + 200 = 380.00 (NOT the 1000 income or the 500 transfer)
      expect(res.grandTotal).toBe('380.00');
    });

    it('respects the date range', async () => {
      // Only the 200.00 rent expense falls on 2026-06-13.
      const res = await service.spendingByCategory(
        A,
        '2026-06-13T00:00:00.000Z',
        '2026-06-13T23:59:59.000Z',
      );
      expect(res.grandTotal).toBe('200.00');
    });

    it("excludes another user's spending", async () => {
      const res = await service.spendingByCategory(A);
      expect(res.grandTotal).toBe('380.00'); // not 380 + 9999
    });

    it('is decimal-exact (0.10 + 0.20 = "0.30")', async () => {
      txns = [
        {
          id: 'x1',
          userId: A,
          kind: 'EXPENSE',
          amount: D('0.10'),
          date: dt('2026-06-10'),
          accountId: 'acc-a',
          toAccountId: null,
          categoryId: 'rent',
        },
        {
          id: 'x2',
          userId: A,
          kind: 'EXPENSE',
          amount: D('0.20'),
          date: dt('2026-06-11'),
          accountId: 'acc-a',
          toAccountId: null,
          categoryId: 'rent',
        },
      ];
      const res = await service.spendingByCategory(A);
      expect(res.grandTotal).toBe('0.30');
      expect(res.categories.find((c) => c.categoryId === 'rent')?.total).toBe(
        '0.30',
      );
    });
  });

  describe('income-vs-expense', () => {
    it('totals income and expense, transfers excluded, net correct', async () => {
      const res = await service.incomeVsExpense(A);
      expect(res).toEqual({
        income: '1000.00',
        expense: '380.00',
        net: '620.00',
      });
    });

    it('net can be negative (range excludes the income)', async () => {
      // 2026-06-10..06-13 covers the 380 expense but not the 06-14 income.
      const res = await service.incomeVsExpense(
        A,
        '2026-06-10T00:00:00.000Z',
        '2026-06-13T23:59:59.000Z',
      );
      expect(res).toEqual({
        income: '0.00',
        expense: '380.00',
        net: '-380.00',
      });
    });
  });

  describe('recent-activity', () => {
    it('returns transfers AND income/expense, date desc, scoped to user', async () => {
      const items = await service.recentActivity(A);
      expect(items.map((i) => i.id)).toEqual([
        't6',
        't5',
        't4',
        't3',
        't2',
        't1',
      ]);
      expect(items.some((i) => i.kind === 'TRANSFER')).toBe(true);
      // The transfer carries both accounts; income/expense carry a category.
      const transfer = items.find((i) => i.id === 't6')!;
      expect(transfer.toAccount).toMatchObject({ id: 'acc-a2' });
      expect(transfer.category).toBeNull();
      expect(items.find((i) => i.id === 't1')?.category).toMatchObject({
        id: 'food',
      });
      // No B transactions.
      expect(items.some((i) => i.id === 'tb')).toBe(false);
    });

    it('respects the limit (and amounts are strings)', async () => {
      const items = await service.recentActivity(A, 2);
      expect(items.map((i) => i.id)).toEqual(['t6', 't5']);
      expect(items.every((i) => typeof i.amount === 'string')).toBe(true);
    });
  });
});
