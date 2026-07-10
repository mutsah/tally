import { Prisma } from '@prisma/client';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ReportsService } from './reports.service';
import { ReportsRangeQueryDto } from './dto/reports-range-query.dto';

// Budget adherence over time. The transaction / category / budget findMany mocks
// honour `where` (userId, kind whitelist, date range) — the same matcher shape the
// Slice A + dashboard specs use — so the EXPENSE-only kind filter and the userId
// scoping are genuinely exercised. `now` is pinned so the dense range is
// deterministic.
describe('ReportsService.monthlyBudgetAdherence', () => {
  const A = 'user-a';
  const B = 'user-b';
  const D = (s: string) => new Prisma.Decimal(s);
  const NOW = new Date(Date.UTC(2026, 6, 15, 12, 0, 0)); // July 2026
  const at = (month: string) => new Date(`${month}-15T00:00:00.000Z`);

  let categories: Array<Record<string, unknown>>;
  let budgets: Array<Record<string, unknown>>;
  let txns: Array<Record<string, unknown>>;
  let prismaMock: {
    category: { findMany: jest.Mock };
    budget: { findMany: jest.Mock };
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

  const matchByUser = (
    row: Record<string, unknown>,
    where: Record<string, unknown>,
  ): boolean =>
    row.userId === where.userId &&
    (where.kind === undefined || row.kind === where.kind);

  beforeEach(() => {
    categories = [
      // A: "Food" (budgeted) with unbudgeted child "Groceries".
      { id: 'food', userId: A, kind: 'EXPENSE', parentId: null },
      { id: 'groc', userId: A, kind: 'EXPENSE', parentId: 'food' },
      // A: "Solo" — a budgeted top-level category with no children.
      { id: 'solo', userId: A, kind: 'EXPENSE', parentId: null },
      // A: an entirely unbudgeted parent + child — spend must be excluded.
      { id: 'unbudg', userId: A, kind: 'EXPENSE', parentId: null },
      { id: 'kid', userId: A, kind: 'EXPENSE', parentId: 'unbudg' },
      // B's category — must never surface in A's report.
      { id: 'b-cat', userId: B, kind: 'EXPENSE', parentId: null },
    ];

    budgets = [
      { userId: A, categoryId: 'food', amount: D('500.00') },
      { userId: A, categoryId: 'solo', amount: D('200.00') },
      { userId: B, categoryId: 'b-cat', amount: D('9999.00') },
    ];

    txns = [
      // July (A): 100 food-direct + 50 groc (child of budgeted food) + 30 solo = 180
      { userId: A, kind: 'EXPENSE', amount: D('100.00'), date: at('2026-07'), categoryId: 'food' },
      { userId: A, kind: 'EXPENSE', amount: D('50.00'), date: at('2026-07'), categoryId: 'groc' },
      { userId: A, kind: 'EXPENSE', amount: D('30.00'), date: at('2026-07'), categoryId: 'solo' },
      // Unbudgeted spend — excluded from `spent`.
      { userId: A, kind: 'EXPENSE', amount: D('999.00'), date: at('2026-07'), categoryId: 'unbudg' },
      { userId: A, kind: 'EXPENSE', amount: D('777.00'), date: at('2026-07'), categoryId: 'kid' },
      // Never counted: transfers and opening balances.
      { userId: A, kind: 'TRANSFER', amount: D('9000.00'), date: at('2026-07'), categoryId: null },
      { userId: A, kind: 'OPENING', amount: D('7000.00'), date: at('2026-07'), categoryId: null },
      // B's spend in a budgeted (B) category — isolation.
      { userId: B, kind: 'EXPENSE', amount: D('5555.00'), date: at('2026-07'), categoryId: 'b-cat' },
    ];

    prismaMock = {
      category: {
        findMany: jest.fn(({ where }) =>
          Promise.resolve(categories.filter((c) => matchByUser(c, where))),
        ),
      },
      budget: {
        findMany: jest.fn(({ where }) =>
          Promise.resolve(budgets.filter((b) => matchByUser(b, where))),
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

  it('budgeted is the sum of the user’s current limits, constant across months', async () => {
    const rows = await service.monthlyBudgetAdherence(A, 12, NOW);
    // 500 (food) + 200 (solo) — B's 9999 excluded.
    expect(new Set(rows.map((r) => r.budgeted))).toEqual(new Set(['700.00']));
    expect(monthOf(rows, '2026-07').budgeted).toBe('700.00');
  });

  it('spent counts budgeted categories (a parent covers its unbudgeted child)', async () => {
    const rows = await service.monthlyBudgetAdherence(A, 12, NOW);
    // 100 food + 50 groc (rolls up to budgeted food) + 30 solo = 180.
    expect(monthOf(rows, '2026-07').spent).toBe('180.00');
  });

  it('spent EXCLUDES expenses in categories with no budget anywhere up the chain', async () => {
    const rows = await service.monthlyBudgetAdherence(A, 12, NOW);
    // The 999 (unbudg) and 777 (kid, child of unbudg) must not appear.
    expect(monthOf(rows, '2026-07').spent).toBe('180.00');
  });

  it('spent EXCLUDES transfers and opening balances (EXPENSE-only kind filter)', async () => {
    const rows = await service.monthlyBudgetAdherence(A, 12, NOW);
    expect(monthOf(rows, '2026-07').spent).toBe('180.00'); // not +9000/+7000
    const txCall = prismaMock.transaction.findMany.mock.calls[0][0];
    expect(txCall.where.kind).toBe('EXPENSE');
  });

  it('counts each expense at most once when a parent AND its child are budgeted', async () => {
    budgets = [
      { userId: A, categoryId: 'food', amount: D('500.00') },
      { userId: A, categoryId: 'groc', amount: D('100.00') },
    ];
    const rows = await service.monthlyBudgetAdherence(A, 12, NOW);
    expect(monthOf(rows, '2026-07').budgeted).toBe('600.00');
    // 100 (food direct) + 50 (groc, under its own budget) — the 50 is NOT double
    // counted via food's rollup.
    expect(monthOf(rows, '2026-07').spent).toBe('150.00');
  });

  it('is DENSE — every month present, spent zero-filled where there is no expense', async () => {
    const rows = await service.monthlyBudgetAdherence(A, 12, NOW);
    expect(rows).toHaveLength(12);
    expect(rows[0].month).toBe('2025-08');
    expect(rows[11].month).toBe('2026-07');
    expect(monthOf(rows, '2026-05')).toMatchObject({
      budgeted: '700.00',
      spent: '0.00',
    });
  });

  it('respects the months range param', async () => {
    const rows = await service.monthlyBudgetAdherence(A, 3, NOW);
    expect(rows.map((r) => r.month)).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
    ]);
  });

  it('money is serialized as STRINGS, not numbers', async () => {
    const jul = monthOf(await service.monthlyBudgetAdherence(A, 12, NOW), '2026-07');
    expect(typeof jul.budgeted).toBe('string');
    expect(typeof jul.spent).toBe('string');
    expect(jul.spent).toMatch(/^\d+\.\d{2}$/);
  });

  it('CROSS-USER ISOLATION: none of B’s budgets or expenses reach A’s report', async () => {
    const rows = await service.monthlyBudgetAdherence(A, 12, NOW);
    const jul = monthOf(rows, '2026-07');
    expect(jul.budgeted).toBe('700.00'); // not 10699.00
    expect(jul.spent).toBe('180.00'); // not 5735.00

    for (const call of prismaMock.transaction.findMany.mock.calls) {
      expect(call[0].where.userId).toBe(A);
    }
    for (const call of prismaMock.category.findMany.mock.calls) {
      expect(call[0].where.userId).toBe(A);
    }
    for (const call of prismaMock.budget.findMany.mock.calls) {
      expect(call[0].where.userId).toBe(A);
    }
  });

  it('B’s own report sees only B’s budget and spend', async () => {
    const jul = monthOf(await service.monthlyBudgetAdherence(B, 12, NOW), '2026-07');
    expect(jul.budgeted).toBe('9999.00');
    expect(jul.spent).toBe('5555.00');
  });
});

// The adherence endpoint reuses ReportsRangeQueryDto, so the same 1..60 bound
// applies (months=0 / months=999 are rejected by the global ValidationPipe → 400).
describe('monthly-budget-adherence range validation', () => {
  const errorsFor = (obj: Record<string, unknown>) =>
    validate(plainToInstance(ReportsRangeQueryDto, obj));

  it('rejects months=0', async () => {
    expect((await errorsFor({ months: 0 })).length).toBeGreaterThan(0);
  });

  it('rejects months=999', async () => {
    expect((await errorsFor({ months: 999 })).length).toBeGreaterThan(0);
  });

  it('accepts a valid months value', async () => {
    expect(await errorsFor({ months: 12 })).toHaveLength(0);
  });
});
