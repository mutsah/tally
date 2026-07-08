import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BudgetsService } from './budgets.service';
import { serializeDecimals } from 'src/common/interceptors/decimal-to-string.interceptor';

// Mirrors the Categories isolation spec: a mocked Prisma delegate over an
// in-memory store that honours the `where` clause, so the userId scoping is
// genuinely exercised. Proves cross-user isolation, the one-per-category rule,
// money-safe amount validation, and money-as-string serialization.
describe('BudgetsService', () => {
  const USER_A = 'user-a';
  const USER_B = 'user-b';
  const A_CAT = 'a-cat';
  const B_CAT = 'b-cat';
  const A_BUDGET = 'a-budget';

  let budgets: Array<Record<string, unknown>>;
  let categories: Array<Record<string, unknown>>;
  let service: BudgetsService;
  let prismaMock: {
    budget: Record<string, jest.Mock>;
    category: { findFirst: jest.Mock };
  };

  const matches = (
    row: Record<string, unknown>,
    where: Record<string, unknown>,
  ) => Object.entries(where).every(([k, v]) => row[k] === v);

  beforeEach(() => {
    categories = [
      { id: A_CAT, userId: USER_A, kind: 'EXPENSE' },
      { id: B_CAT, userId: USER_B, kind: 'EXPENSE' },
    ];
    budgets = [
      { id: A_BUDGET, userId: USER_A, categoryId: A_CAT, amount: new Prisma.Decimal('500.00') },
    ];

    prismaMock = {
      budget: {
        findMany: jest.fn(({ where }) =>
          Promise.resolve(budgets.filter((r) => matches(r, where))),
        ),
        findFirst: jest.fn(({ where }) =>
          Promise.resolve(budgets.find((r) => matches(r, where)) ?? null),
        ),
        create: jest.fn(({ data }) => {
          const row = { id: 'new-budget', ...data };
          budgets.push(row);
          return Promise.resolve(row);
        }),
        updateMany: jest.fn(({ where, data }) => {
          const rows = budgets.filter((r) => matches(r, where));
          rows.forEach((r) => Object.assign(r, data));
          return Promise.resolve({ count: rows.length });
        }),
        deleteMany: jest.fn(({ where }) => {
          const before = budgets.length;
          budgets = budgets.filter((r) => !matches(r, where));
          return Promise.resolve({ count: before - budgets.length });
        }),
      },
      category: {
        // assertCategoryOwned uses findFirst({ where: { id, userId }, select }).
        findFirst: jest.fn(({ where }) =>
          Promise.resolve(categories.find((r) => matches(r, where)) ?? null),
        ),
      },
    };

    service = new BudgetsService(prismaMock as never);
  });

  describe('tenant isolation', () => {
    it('create injects the caller userId', async () => {
      // Give B a brand-new category so A_CAT stays the only A budget.
      categories.push({ id: 'a-cat-2', userId: USER_A, kind: 'EXPENSE' });
      await service.create(USER_A, { categoryId: 'a-cat-2', amount: '120.00' });
      expect(prismaMock.budget.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: USER_A, categoryId: 'a-cat-2' }),
        }),
      );
    });

    it('list returns only the caller’s budgets', async () => {
      budgets.push({
        id: 'b-budget',
        userId: USER_B,
        categoryId: B_CAT,
        amount: new Prisma.Decimal('90.00'),
      });
      const aList = await service.findAll(USER_A);
      const bList = await service.findAll(USER_B);
      expect(aList.map((b) => b.id)).toEqual([A_BUDGET]);
      expect(bList.map((b) => b.id)).toEqual(['b-budget']);
    });

    it('A cannot read B’s budget → 404', async () => {
      budgets.push({
        id: 'b-budget',
        userId: USER_B,
        categoryId: B_CAT,
        amount: new Prisma.Decimal('90.00'),
      });
      await expect(service.findOne(USER_A, 'b-budget')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('A cannot update B’s budget → 404, no write applied', async () => {
      budgets.push({
        id: 'b-budget',
        userId: USER_B,
        categoryId: B_CAT,
        amount: new Prisma.Decimal('90.00'),
      });
      await expect(
        service.update(USER_A, 'b-budget', { amount: '1.00' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(
        (budgets.find((r) => r.id === 'b-budget')?.amount as Prisma.Decimal).toFixed(2),
      ).toBe('90.00');
    });

    it('A cannot delete B’s budget → 404, B’s row remains', async () => {
      budgets.push({
        id: 'b-budget',
        userId: USER_B,
        categoryId: B_CAT,
        amount: new Prisma.Decimal('90.00'),
      });
      await expect(service.remove(USER_A, 'b-budget')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(budgets.find((r) => r.id === 'b-budget')).toBeDefined();
    });

    it('writes are scoped by BOTH id AND userId', async () => {
      await service.update(USER_A, A_BUDGET, { amount: '650.00' });
      expect(prismaMock.budget.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: A_BUDGET, userId: USER_A } }),
      );
    });

    it('cannot budget another user’s category → 400', async () => {
      await expect(
        service.create(USER_A, { categoryId: B_CAT, amount: '100.00' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.budget.create).not.toHaveBeenCalled();
    });
  });

  describe('expense-only', () => {
    it('rejects budgeting a non-EXPENSE (income) category → 400, no write', async () => {
      categories.push({ id: 'income-cat', userId: USER_A, kind: 'INCOME' });
      await expect(
        service.create(USER_A, { categoryId: 'income-cat', amount: '100.00' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.budget.create).not.toHaveBeenCalled();
    });

    it('allows budgeting an EXPENSE category (happy path)', async () => {
      categories.push({ id: 'exp-cat', userId: USER_A, kind: 'EXPENSE' });
      const budget = await service.create(USER_A, {
        categoryId: 'exp-cat',
        amount: '200.00',
      });
      expect(budget).toMatchObject({ categoryId: 'exp-cat', userId: USER_A });
    });
  });

  describe('one budget per category', () => {
    it('rejects a second budget for the same category → 409', async () => {
      await expect(
        service.create(USER_A, { categoryId: A_CAT, amount: '10.00' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prismaMock.budget.create).not.toHaveBeenCalled();
    });

    it('updates an existing budget’s amount', async () => {
      const updated = await service.update(USER_A, A_BUDGET, { amount: '650.00' });
      expect((updated.amount as Prisma.Decimal).toFixed(2)).toBe('650.00');
    });
  });

  describe('amount validation (money-safe, no floats)', () => {
    it('rejects zero', async () => {
      categories.push({ id: 'c0', userId: USER_A, kind: 'EXPENSE' });
      await expect(
        service.create(USER_A, { categoryId: 'c0', amount: '0' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a negative amount', async () => {
      categories.push({ id: 'cneg', userId: USER_A, kind: 'EXPENSE' });
      await expect(
        service.create(USER_A, { categoryId: 'cneg', amount: '-5.00' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects more than 2 decimal places', async () => {
      categories.push({ id: 'cdp', userId: USER_A, kind: 'EXPENSE' });
      await expect(
        service.create(USER_A, { categoryId: 'cdp', amount: '1.999' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('stores amount as a Prisma.Decimal, never a JS number', async () => {
      categories.push({ id: 'cok', userId: USER_A, kind: 'EXPENSE' });
      await service.create(USER_A, { categoryId: 'cok', amount: '42.50' });
      const arg = prismaMock.budget.create.mock.calls[0][0];
      expect(Prisma.Decimal.isDecimal(arg.data.amount)).toBe(true);
      expect(typeof arg.data.amount).not.toBe('number');
    });
  });

  describe('money-as-string serialization', () => {
    it('a budget row’s Decimal amount serializes to a 2-dp string', () => {
      const row = {
        id: A_BUDGET,
        amount: new Prisma.Decimal('500'),
      };
      const out = serializeDecimals(row) as { amount: unknown };
      expect(out.amount).toBe('500.00');
      expect(typeof out.amount).toBe('string');
    });
  });
});
