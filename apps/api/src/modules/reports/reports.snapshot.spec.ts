import { Prisma } from '@prisma/client';
import { ReportsService } from './reports.service';

// Slice C point-in-time reports: cash runway + spending leaks.
//
// The transaction/category findMany mocks honour `where` (userId, kind whitelist,
// date range) — the same matcher shape the Slice A/B and dashboard specs use — so
// the EXPENSE/INCOME kind filters and the userId scoping are genuinely exercised.
// AccountsService.findAll is mocked per-user (the real grouped-balance logic is
// tested in the accounts specs). `now` is pinned so "complete month" maths is
// deterministic.
//
// NOW = 2026-07-15, so:
//   current PARTIAL month = 2026-07   (always excluded)
//   complete months        = 2026-06, 2026-05, 2026-04, 2026-03 ...
//   runway burn window     = 2026-04 .. 2026-06
//   leaks: current=2026-06, baseline=2026-03..2026-05
describe('ReportsService — runway & spending leaks', () => {
  const A = 'user-a';
  const B = 'user-b';
  const D = (s: string) => new Prisma.Decimal(s);
  const NOW = new Date(Date.UTC(2026, 6, 15, 12, 0, 0));
  const at = (month: string) => new Date(`${month}-15T00:00:00.000Z`);

  let accounts: Array<Record<string, unknown>>;
  let categories: Array<Record<string, unknown>>;
  let txns: Array<Record<string, unknown>>;
  let accountsServiceMock: { findAll: jest.Mock };
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

  const expense = (userId: string, month: string, amount: string, categoryId: string | null) => ({
    userId,
    kind: 'EXPENSE',
    amount: D(amount),
    date: at(month),
    categoryId,
  });
  const income = (userId: string, month: string, amount: string) => ({
    userId,
    kind: 'INCOME',
    amount: D(amount),
    date: at(month),
    categoryId: null,
  });

  const build = () => {
    accountsServiceMock = {
      findAll: jest.fn((userId: string) =>
        Promise.resolve(accounts.filter((a) => a.userId === userId)),
      ),
    };
    prismaMock = {
      category: {
        findMany: jest.fn(({ where }) =>
          Promise.resolve(
            categories.filter(
              (c) =>
                c.userId === where.userId &&
                (where.kind === undefined || c.kind === where.kind),
            ),
          ),
        ),
      },
      transaction: {
        findMany: jest.fn(({ where }) =>
          Promise.resolve(txns.filter((t) => matchTx(t, where))),
        ),
      },
    };
    service = new ReportsService(
      prismaMock as never,
      accountsServiceMock as never,
    );
  };

  beforeEach(() => {
    accounts = [
      { userId: A, id: 'cash', type: 'CASH', archived: false, balance: '1000.00' },
      { userId: A, id: 'bank', type: 'BANK', archived: false, balance: '500.00' },
      // Illiquid — must NOT count toward the buffer.
      { userId: A, id: 'inv', type: 'INVESTMENT', archived: false, balance: '9999.00' },
      { userId: A, id: 'loan', type: 'MICROLOANS', archived: false, balance: '8888.00' },
      // Archived — excluded, matching net worth.
      { userId: A, id: 'old', type: 'BANK', archived: true, balance: '700.00' },
      { userId: B, id: 'b-cash', type: 'CASH', archived: false, balance: '4242.00' },
    ];

    categories = [
      { id: 'food', userId: A, name: 'Food', kind: 'EXPENSE' },
      { id: 'gas', userId: A, name: 'Gas', kind: 'EXPENSE' },
      { id: 'fun', userId: A, name: 'Fun', kind: 'EXPENSE' },
      { id: 'tiny', userId: A, name: 'Tiny', kind: 'EXPENSE' },
      { id: 'fresh', userId: A, name: 'Fresh', kind: 'EXPENSE' },
      { id: 'b-cat', userId: B, name: 'B Food', kind: 'EXPENSE' },
    ];

    txns = [
      // ── Burn window: net outflow 300 each month (expense − income) ──
      income(A, '2026-04', '100.00'), expense(A, '2026-04', '400.00', 'food'),
      income(A, '2026-05', '200.00'), expense(A, '2026-05', '500.00', 'food'),
      income(A, '2026-06', '300.00'), expense(A, '2026-06', '600.00', 'food'),
      // Current PARTIAL month — must never influence burn or leaks.
      income(A, '2026-07', '1.00'), expense(A, '2026-07', '99999.00', 'food'),
      // Never counted anywhere: transfers + opening balances.
      { userId: A, kind: 'TRANSFER', amount: D('9000.00'), date: at('2026-05'), categoryId: null },
      { userId: A, kind: 'OPENING', amount: D('7000.00'), date: at('2026-05'), categoryId: null },
      // B's activity — isolation.
      income(B, '2026-05', '50000.00'), expense(B, '2026-06', '60000.00', 'b-cat'),
    ];

    build();
  });

  // Give a category an exact per-month spend profile for the leak window.
  const seedLeakProfile = (
    categoryId: string,
    baselineEach: string,
    current: string,
  ) => {
    for (const m of ['2026-03', '2026-04', '2026-05']) {
      txns.push(expense(A, m, baselineEach, categoryId));
    }
    txns.push(expense(A, '2026-06', current, categoryId));
  };

  describe('runway', () => {
    it('buffer excludes INVESTMENT/MICROLOANS and archived accounts', async () => {
      const r = await service.runway(A, NOW);
      expect(r.buffer).toBe('1500.00'); // 1000 cash + 500 bank only
      expect(accountsServiceMock.findAll).toHaveBeenCalledWith(A);
    });

    it('burn is NET (income offsets expense), averaged over 3 COMPLETE months', async () => {
      const r = await service.runway(A, NOW);
      // (400-100) + (500-200) + (600-300) = 900 over 3 months.
      expect(r.monthlyBurn).toBe('300.00');
    });

    it('the in-progress current month is excluded from burn', async () => {
      const r = await service.runway(A, NOW);
      // The 99999 July expense would wreck this if the partial month counted.
      expect(r.monthlyBurn).toBe('300.00');
    });

    it('transfers and opening balances never count toward burn', async () => {
      const r = await service.runway(A, NOW);
      expect(r.monthlyBurn).toBe('300.00'); // not +9000/+7000
      const where = prismaMock.transaction.findMany.mock.calls[0][0].where;
      expect(where.kind).toEqual({ in: ['INCOME', 'EXPENSE'] });
    });

    it('runwayMonths = buffer / burn, to one decimal place', async () => {
      const r = await service.runway(A, NOW);
      expect(r.runwayMonths).toBe('5.0'); // 1500 / 300
    });

    it('runwayMonths is null when the user is net-positive (no divide)', async () => {
      // Flip the sign: income now exceeds expense every complete month.
      txns = [
        income(A, '2026-04', '900.00'), expense(A, '2026-04', '400.00', 'food'),
        income(A, '2026-05', '900.00'), expense(A, '2026-05', '500.00', 'food'),
        income(A, '2026-06', '900.00'), expense(A, '2026-06', '600.00', 'food'),
      ];
      build();
      const r = await service.runway(A, NOW);
      expect(r.monthlyBurn).toBe('-400.00'); // net inflow
      expect(r.runwayMonths).toBeNull();
    });

    it('runwayMonths is null at exactly break-even (burn = 0)', async () => {
      txns = [
        income(A, '2026-04', '400.00'), expense(A, '2026-04', '400.00', 'food'),
        income(A, '2026-05', '500.00'), expense(A, '2026-05', '500.00', 'food'),
        income(A, '2026-06', '600.00'), expense(A, '2026-06', '600.00', 'food'),
      ];
      build();
      const r = await service.runway(A, NOW);
      expect(r.monthlyBurn).toBe('0.00');
      expect(r.runwayMonths).toBeNull();
    });

    it('an overdrawn buffer with positive burn clamps to "0.0", never negative', async () => {
      // Only a single, overdrawn liquid account.
      accounts = [
        { userId: A, id: 'cash', type: 'CASH', archived: false, balance: '-500.00' },
      ];
      build();
      const r = await service.runway(A, NOW);
      expect(r.buffer).toBe('-500.00'); // the buffer itself may legitimately be negative
      expect(r.monthlyBurn).toBe('300.00'); // still burning
      expect(r.runwayMonths).toBe('0.0'); // no runway left — NOT "-1.7"
      expect(r.runwayMonths!.startsWith('-')).toBe(false);
    });

    it('a zero buffer with positive burn is "0.0"', async () => {
      accounts = [
        { userId: A, id: 'cash', type: 'CASH', archived: false, balance: '0.00' },
      ];
      build();
      const r = await service.runway(A, NOW);
      expect(r.runwayMonths).toBe('0.0');
    });

    // Pins the BRANCH ORDER: monthlyBurn <= 0 must be tested BEFORE buffer <= 0.
    // Overdrawn AND net-positive → null (no runway figure at all), never "0.0".
    // Swapping the two branches would silently turn this into "0.0".
    it('overdrawn AND net-positive → null, not "0.0" (burn is checked first)', async () => {
      accounts = [
        { userId: A, id: 'cash', type: 'CASH', archived: false, balance: '-500.00' },
      ];
      txns = [
        income(A, '2026-04', '900.00'), expense(A, '2026-04', '400.00', 'food'),
        income(A, '2026-05', '900.00'), expense(A, '2026-05', '500.00', 'food'),
        income(A, '2026-06', '900.00'), expense(A, '2026-06', '600.00', 'food'),
      ];
      build();
      const r = await service.runway(A, NOW);
      expect(r.buffer).toBe('-500.00'); // negative buffer is a real cash position
      expect(r.monthlyBurn).toBe('-400.00'); // net inflow → not burning
      expect(r.runwayMonths).toBeNull(); // NOT '0.0'
    });

    it('money fields are STRINGS', async () => {
      const r = await service.runway(A, NOW);
      expect(typeof r.buffer).toBe('string');
      expect(typeof r.monthlyBurn).toBe('string');
      expect(r.buffer).toMatch(/^-?\d+\.\d{2}$/);
    });

    it('CROSS-USER ISOLATION: none of B’s accounts or transactions reach A', async () => {
      const r = await service.runway(A, NOW);
      expect(r.buffer).toBe('1500.00'); // not 5742.00 (B's 4242 cash)
      expect(r.monthlyBurn).toBe('300.00'); // untouched by B's 50k/60k
      for (const call of prismaMock.transaction.findMany.mock.calls) {
        expect(call[0].where.userId).toBe(A);
      }
      expect(accountsServiceMock.findAll).toHaveBeenCalledWith(A);
      expect(accountsServiceMock.findAll).not.toHaveBeenCalledWith(B);
    });

    it('B’s own runway sees only B’s data', async () => {
      const r = await service.runway(B, NOW);
      expect(r.buffer).toBe('4242.00');
      // B: 2026-05 income 50000, 2026-06 expense 60000 → (0-50000)+(60000-0) = 10000 / 3
      expect(r.monthlyBurn).toBe('3333.33');
    });
  });

  describe('spendingLeaks', () => {
    it('flags a category above the growth threshold with the right ratio', async () => {
      txns = [];
      seedLeakProfile('food', '100.00', '200.00'); // avg 100 → 200 = +100%
      build();
      const leaks = await service.spendingLeaks(A, NOW);
      expect(leaks).toHaveLength(1);
      expect(leaks[0]).toEqual({
        categoryId: 'food',
        categoryName: 'Food',
        currentSpend: '200.00',
        trailingAverage: '100.00',
        pctIncrease: '100.0', // percentage: 100 → 200 is +100%
      });
    });

    it('does NOT flag a category under the threshold', async () => {
      txns = [];
      seedLeakProfile('fun', '100.00', '110.00'); // +10% < 25%
      build();
      expect(await service.spendingLeaks(A, NOW)).toEqual([]);
    });

    it('the threshold runs on the RAW ratio, not the rounded percentage', async () => {
      // 125.10 / 100 = ratio 0.251 — only just over the 0.25 threshold. The old
      // ratio-at-1dp output would have rendered this as "0.3" (i.e. 30%).
      txns = [];
      seedLeakProfile('food', '100.00', '125.10');
      build();
      const leaks = await service.spendingLeaks(A, NOW);
      expect(leaks).toHaveLength(1);
      expect(leaks[0].pctIncrease).toBe('25.1');
    });

    it('a ratio just BELOW the threshold is still excluded', async () => {
      txns = [];
      seedLeakProfile('food', '100.00', '124.90'); // ratio 0.249 → not > 0.25
      build();
      expect(await service.spendingLeaks(A, NOW)).toEqual([]);
    });

    it('skips a category whose trailing average is below LEAK_MIN_BASELINE', async () => {
      txns = [];
      seedLeakProfile('tiny', '10.00', '100.00'); // +900% but baseline 10 < 20
      build();
      expect(await service.spendingLeaks(A, NOW)).toEqual([]);
    });

    it('a zero-trailing (brand-new) category never divides by zero and is absent', async () => {
      txns = [expense(A, '2026-06', '500.00', 'fresh')]; // no baseline at all
      build();
      const leaks = await service.spendingLeaks(A, NOW);
      expect(leaks).toEqual([]);
      expect(leaks.every((l) => l.pctIncrease !== 'Infinity')).toBe(true);
    });

    it('the in-progress current month is excluded from both sides', async () => {
      txns = [];
      seedLeakProfile('fun', '100.00', '100.00'); // flat → not a leak
      txns.push(expense(A, '2026-07', '99999.00', 'fun')); // partial month spike
      build();
      expect(await service.spendingLeaks(A, NOW)).toEqual([]);
    });

    it('transfers and opening balances never count', async () => {
      txns = [];
      seedLeakProfile('fun', '100.00', '100.00');
      txns.push({ userId: A, kind: 'TRANSFER', amount: D('9000.00'), date: at('2026-06'), categoryId: 'fun' });
      txns.push({ userId: A, kind: 'OPENING', amount: D('7000.00'), date: at('2026-06'), categoryId: 'fun' });
      build();
      expect(await service.spendingLeaks(A, NOW)).toEqual([]);
      const where = prismaMock.transaction.findMany.mock.calls[0][0].where;
      expect(where.kind).toBe('EXPENSE');
    });

    it('sorts biggest leak first', async () => {
      txns = [];
      seedLeakProfile('food', '100.00', '200.00'); // +100%
      seedLeakProfile('gas', '100.00', '150.00'); // +50%
      build();
      const leaks = await service.spendingLeaks(A, NOW);
      expect(leaks.map((l) => l.categoryId)).toEqual(['food', 'gas']);
      expect(leaks.map((l) => l.pctIncrease)).toEqual(['100.0', '50.0']);
    });

    it('returns an empty array when nothing qualifies', async () => {
      txns = [];
      build();
      expect(await service.spendingLeaks(A, NOW)).toEqual([]);
    });

    it('CROSS-USER ISOLATION: B’s categories and spend never appear in A’s leaks', async () => {
      txns = [];
      seedLeakProfile('food', '100.00', '200.00');
      // B has an even bigger leak — must not surface in A's report.
      for (const m of ['2026-03', '2026-04', '2026-05']) {
        txns.push(expense(B, m, '100.00', 'b-cat'));
      }
      txns.push(expense(B, '2026-06', '900.00', 'b-cat'));
      build();

      const leaks = await service.spendingLeaks(A, NOW);
      expect(leaks.map((l) => l.categoryId)).toEqual(['food']);
      for (const call of prismaMock.transaction.findMany.mock.calls) {
        expect(call[0].where.userId).toBe(A);
      }
      for (const call of prismaMock.category.findMany.mock.calls) {
        expect(call[0].where.userId).toBe(A);
      }
    });

    it('B’s own leaks report sees only B’s data', async () => {
      txns = [];
      for (const m of ['2026-03', '2026-04', '2026-05']) {
        txns.push(expense(B, m, '100.00', 'b-cat'));
      }
      txns.push(expense(B, '2026-06', '900.00', 'b-cat'));
      build();
      const leaks = await service.spendingLeaks(B, NOW);
      expect(leaks).toHaveLength(1);
      expect(leaks[0].categoryId).toBe('b-cat');
      expect(leaks[0].pctIncrease).toBe('800.0'); // (900-100)/100 = +800%
    });
  });
});
