import { Prisma } from '@prisma/client';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ReportsService } from './reports.service';
import { ReportsRangeQueryDto } from './dto/reports-range-query.dto';

// Multi-tenant monthly aggregation. The transaction.findMany / category.findMany
// mocks honour `where` (userId, kind whitelist, date range) — the SAME matcher
// shape the dashboard spec uses — so transfer/opening exclusion and userId
// scoping are genuinely exercised, not assumed. `now` is pinned so the dense
// month range is deterministic.
describe('ReportsService', () => {
  const A = 'user-a';
  const B = 'user-b';
  const D = (s: string) => new Prisma.Decimal(s);
  // A UTC instant inside July 2026, so months run …→ '2026-07'.
  const NOW = new Date(Date.UTC(2026, 6, 15, 12, 0, 0));
  const at = (month: string, day = 15) =>
    new Date(`${month}-${String(day).padStart(2, '0')}T00:00:00.000Z`);

  let categories: Array<Record<string, unknown>>;
  let txns: Array<Record<string, unknown>>;
  let prismaMock: {
    category: { findMany: jest.Mock };
    transaction: { findMany: jest.Mock };
  };
  let service: ReportsService;

  const matchTx = (
    t: Record<string, unknown>,
    where: Record<string, unknown>,
  ): boolean => {
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

  const matchCat = (
    c: Record<string, unknown>,
    where: Record<string, unknown>,
  ): boolean =>
    c.userId === where.userId &&
    (where.kind === undefined || c.kind === where.kind);

  beforeEach(() => {
    // A's expense categories: a parent "Food" with child "Groceries".
    categories = [
      { id: 'food', userId: A, name: 'Food', kind: 'EXPENSE', parentId: null },
      {
        id: 'groc',
        userId: A,
        name: 'Groceries',
        kind: 'EXPENSE',
        parentId: 'food',
      },
      // B's category — must never surface in A's report.
      { id: 'b-cat', userId: B, name: 'B Food', kind: 'EXPENSE', parentId: null },
    ];

    txns = [
      // July 2026 (A): income 1000, expense 300 (200 Food-direct + 100 Groceries)
      { userId: A, kind: 'INCOME', amount: D('1000.00'), date: at('2026-07'), categoryId: null },
      { userId: A, kind: 'EXPENSE', amount: D('200.00'), date: at('2026-07'), categoryId: 'food' },
      { userId: A, kind: 'EXPENSE', amount: D('100.00'), date: at('2026-07'), categoryId: 'groc' },
      // June 2026 (A): income 500, expense 800 → net -300
      { userId: A, kind: 'INCOME', amount: D('500.00'), date: at('2026-06'), categoryId: null },
      { userId: A, kind: 'EXPENSE', amount: D('800.00'), date: at('2026-06'), categoryId: 'food' },
      // A transfer + an opening in July — MUST be excluded from income/expense.
      { userId: A, kind: 'TRANSFER', amount: D('9000.00'), date: at('2026-07'), categoryId: null },
      { userId: A, kind: 'OPENING', amount: D('7000.00'), date: at('2026-07'), categoryId: null },
      // B's income in July — isolation: must not touch A's totals.
      { userId: B, kind: 'INCOME', amount: D('99999.00'), date: at('2026-07'), categoryId: null },
      { userId: B, kind: 'EXPENSE', amount: D('55555.00'), date: at('2026-07'), categoryId: 'b-cat' },
    ];

    prismaMock = {
      category: {
        findMany: jest.fn(({ where }) =>
          Promise.resolve(categories.filter((c) => matchCat(c, where))),
        ),
      },
      transaction: {
        findMany: jest.fn(({ where }) =>
          Promise.resolve(txns.filter((t) => matchTx(t, where))),
        ),
      },
    };

    // AccountsService is only used by the runway report; not exercised here.
    service = new ReportsService(prismaMock as never, {} as never);
  });

  const monthOf = (rows: Array<{ month: string }>, m: string) =>
    rows.find((r) => r.month === m)!;

  describe('monthlyIncomeExpense', () => {
    it('per-month income / expense / net are correct', async () => {
      const rows = await service.monthlyIncomeExpense(A, 12, NOW);
      const jul = monthOf(rows, '2026-07');
      expect(jul).toMatchObject({
        income: '1000.00',
        expense: '300.00',
        net: '700.00',
      });
    });

    it('excludes TRANSFER and OPENING from income and expense', async () => {
      const rows = await service.monthlyIncomeExpense(A, 12, NOW);
      const jul = monthOf(rows, '2026-07');
      // The 9000 transfer and 7000 opening would blow these up if counted.
      expect(jul.income).toBe('1000.00');
      expect(jul.expense).toBe('300.00');
      // And the query itself only whitelists INCOME + EXPENSE.
      const where = prismaMock.transaction.findMany.mock.calls[0][0].where;
      expect(where.kind).toEqual({ in: ['INCOME', 'EXPENSE'] });
      expect(where.userId).toBe(A);
    });

    it('produces a NEGATIVE net when expense exceeds income', async () => {
      const rows = await service.monthlyIncomeExpense(A, 12, NOW);
      expect(monthOf(rows, '2026-06').net).toBe('-300.00');
    });

    it('is DENSE — every month present, zero-filled where there is no activity', async () => {
      const rows = await service.monthlyIncomeExpense(A, 12, NOW);
      expect(rows).toHaveLength(12);
      expect(rows[0].month).toBe('2025-08');
      expect(rows[11].month).toBe('2026-07');
      const may = monthOf(rows, '2026-05');
      expect(may).toMatchObject({
        income: '0.00',
        expense: '0.00',
        net: '0.00',
      });
    });

    it('money is serialized as a STRING, not a number', async () => {
      const rows = await service.monthlyIncomeExpense(A, 12, NOW);
      const jul = monthOf(rows, '2026-07');
      expect(typeof jul.income).toBe('string');
      expect(jul.income).toMatch(/^-?\d+\.\d{2}$/);
    });

    it('respects the months range param', async () => {
      const rows = await service.monthlyIncomeExpense(A, 3, NOW);
      expect(rows.map((r) => r.month)).toEqual(['2026-05', '2026-06', '2026-07']);
    });

    it('CROSS-USER ISOLATION: A’s totals contain none of B’s transactions', async () => {
      const rows = await service.monthlyIncomeExpense(A, 12, NOW);
      const jul = monthOf(rows, '2026-07');
      expect(jul.income).toBe('1000.00'); // not 100999.00
      expect(jul.expense).toBe('300.00'); // not 55855.00
      // Every findMany call is scoped to A.
      for (const call of prismaMock.transaction.findMany.mock.calls) {
        expect(call[0].where.userId).toBe(A);
      }
    });
  });

  describe('monthlyExpenseByCategory', () => {
    it('rolls up parent = own + children per month (matching the dashboard)', async () => {
      const rows = await service.monthlyExpenseByCategory(A, 12, NOW);
      const jul = monthOf(rows, '2026-07');
      const food = jul.categories.find((c) => c.categoryId === 'food')!;
      // Food direct 200 + Groceries child 100 = 300.
      expect(food.total).toBe('300.00');
      const groc = food.children.find((c) => c.categoryId === 'groc')!;
      expect(groc.total).toBe('100.00');
      expect(jul.grandTotal).toBe('300.00');
    });

    it('is dense and zero-filled for a month with no expense', async () => {
      const rows = await service.monthlyExpenseByCategory(A, 12, NOW);
      const may = monthOf(rows, '2026-05');
      expect(may.grandTotal).toBe('0.00');
      const food = may.categories.find((c) => c.categoryId === 'food')!;
      expect(food.total).toBe('0.00');
    });

    it('money as strings; excludes transfers/opening (EXPENSE only)', async () => {
      const rows = await service.monthlyExpenseByCategory(A, 12, NOW);
      expect(typeof monthOf(rows, '2026-07').grandTotal).toBe('string');
      const where = prismaMock.transaction.findMany.mock.calls[0][0].where;
      expect(where.kind).toBe('EXPENSE');
    });

    it('CROSS-USER ISOLATION: no B categories or spend in A’s report', async () => {
      const rows = await service.monthlyExpenseByCategory(A, 12, NOW);
      for (const month of rows) {
        expect(month.categories.some((c) => c.categoryId === 'b-cat')).toBe(
          false,
        );
      }
      for (const call of prismaMock.transaction.findMany.mock.calls) {
        expect(call[0].where.userId).toBe(A);
      }
      for (const call of prismaMock.category.findMany.mock.calls) {
        expect(call[0].where.userId).toBe(A);
      }
    });
  });
});

describe('ReportsRangeQueryDto', () => {
  const errorsFor = (obj: Record<string, unknown>) =>
    validate(plainToInstance(ReportsRangeQueryDto, obj));

  it('accepts an omitted months (defaults handled in the service)', async () => {
    expect(await errorsFor({})).toHaveLength(0);
  });

  it('accepts a valid months value', async () => {
    expect(await errorsFor({ months: 12 })).toHaveLength(0);
  });

  it('rejects months below 1', async () => {
    expect((await errorsFor({ months: 0 })).length).toBeGreaterThan(0);
  });

  it('rejects months above the cap', async () => {
    expect((await errorsFor({ months: 999 })).length).toBeGreaterThan(0);
  });
});
