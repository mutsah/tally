import {
  BadRequestException,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TransactionsService } from './transactions.service';

// Mirrors the Accounts/Categories isolation specs and adds the money/category
// validation + pagination coverage. The Prisma delegate and the account/category
// lookups are mocked over in-memory stores that honour the `where` clause, so the
// userId scoping is genuinely exercised.
describe('TransactionsService', () => {
  const A = 'user-a';
  const B = 'user-b';

  const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  let accounts: Array<Record<string, unknown>>;
  let categories: Array<Record<string, unknown>>;
  let txStore: Array<Record<string, unknown>>;
  let prismaMock: {
    transaction: Record<string, jest.Mock>;
    account: { findFirst: jest.Mock };
    category: { findFirst: jest.Mock };
  };
  let service: TransactionsService;

  const matchesWhere = (
    row: Record<string, unknown>,
    where: Record<string, unknown> = {},
  ) =>
    Object.entries(where).every(([k, v]) => {
      if (k === 'date' && v && typeof v === 'object') {
        const range = v as { gte?: Date; lte?: Date };
        const rowDate = row.date as Date;
        if (range.gte && rowDate < range.gte) return false;
        if (range.lte && rowDate > range.lte) return false;
        return true;
      }
      return row[k] === v;
    });

  const baseTx = (over: Record<string, unknown>) => ({
    note: null,
    toAccountId: null,
    amount: new Prisma.Decimal('10.00'),
    ...over,
  });

  beforeEach(() => {
    accounts = [
      { id: 'acc-a', userId: A },
      { id: 'acc-a2', userId: A },
      { id: 'acc-b', userId: B },
    ];
    categories = [
      { id: 'cat-exp-a', userId: A, kind: 'EXPENSE' },
      { id: 'cat-inc-a', userId: A, kind: 'INCOME' },
      { id: 'cat-b', userId: B, kind: 'EXPENSE' },
    ];
    txStore = [
      baseTx({
        id: 'tx-b',
        userId: B,
        kind: 'EXPENSE',
        date: d('2026-06-01'),
        accountId: 'acc-b',
        categoryId: 'cat-b',
      }),
      baseTx({
        id: 'tx-a1',
        userId: A,
        kind: 'EXPENSE',
        date: d('2026-06-10'),
        accountId: 'acc-a',
        categoryId: 'cat-exp-a',
      }),
      baseTx({
        id: 'tx-a2',
        userId: A,
        kind: 'EXPENSE',
        date: d('2026-06-20'),
        accountId: 'acc-a2',
        categoryId: 'cat-exp-a',
      }),
      baseTx({
        id: 'tx-a3',
        userId: A,
        kind: 'EXPENSE',
        date: d('2026-06-05'),
        accountId: 'acc-a',
        categoryId: 'cat-exp-a',
      }),
    ];

    prismaMock = {
      transaction: {
        findMany: jest.fn(({ where, skip = 0, take }) => {
          let rows = txStore.filter((r) => matchesWhere(r, where));
          rows = [...rows].sort(
            (a, b) => (b.date as Date).getTime() - (a.date as Date).getTime(),
          );
          if (take !== undefined) rows = rows.slice(skip, skip + take);
          return Promise.resolve(rows);
        }),
        findFirst: jest.fn(({ where }) =>
          Promise.resolve(txStore.find((r) => matchesWhere(r, where)) ?? null),
        ),
        create: jest.fn(({ data }) => {
          const row = { id: 'new-id', ...data };
          txStore.push(row);
          return Promise.resolve(row);
        }),
        updateMany: jest.fn(({ where, data }) => {
          const rows = txStore.filter((r) => matchesWhere(r, where));
          rows.forEach((r) => Object.assign(r, data));
          return Promise.resolve({ count: rows.length });
        }),
        deleteMany: jest.fn(({ where }) => {
          const before = txStore.length;
          txStore = txStore.filter((r) => !matchesWhere(r, where));
          return Promise.resolve({ count: before - txStore.length });
        }),
        count: jest.fn(({ where }) =>
          Promise.resolve(txStore.filter((r) => matchesWhere(r, where)).length),
        ),
      },
      account: {
        findFirst: jest.fn(({ where }) =>
          Promise.resolve(accounts.find((a) => matchesWhere(a, where)) ?? null),
        ),
      },
      category: {
        findFirst: jest.fn(({ where }) =>
          Promise.resolve(
            categories.find((c) => matchesWhere(c, where)) ?? null,
          ),
        ),
      },
    };

    service = new TransactionsService(prismaMock as never);
  });

  const validExpense = {
    kind: 'EXPENSE' as never,
    amount: '50.00',
    date: '2026-06-15T00:00:00.000Z',
    accountId: 'acc-a',
    categoryId: 'cat-exp-a',
  };

  describe('tenant isolation', () => {
    it("list returns only the caller's transactions", async () => {
      const a = await service.findAll(A, {});
      const b = await service.findAll(B, {});
      expect(a.data.map((t) => t.id).sort()).toEqual([
        'tx-a1',
        'tx-a2',
        'tx-a3',
      ]);
      expect(b.data.map((t) => t.id)).toEqual(['tx-b']);
    });

    it("A cannot read B's transaction → 404; B can", async () => {
      await expect(service.findOne(A, 'tx-b')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.findOne(B, 'tx-b')).resolves.toMatchObject({
        id: 'tx-b',
      });
    });

    it("A cannot update B's transaction → 404, untouched", async () => {
      await expect(
        service.update(A, 'tx-b', { note: 'hijacked' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(txStore.find((r) => r.id === 'tx-b')?.note).toBeNull();
    });

    it("A cannot delete B's transaction → 404, remains", async () => {
      await expect(service.remove(A, 'tx-b')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(txStore.find((r) => r.id === 'tx-b')).toBeDefined();
      expect(prismaMock.transaction.deleteMany).not.toHaveBeenCalled();
    });

    it('writes are scoped by BOTH id AND userId', async () => {
      await service.update(B, 'tx-b', { note: 'mine' });
      expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tx-b', userId: B } }),
      );
    });

    it('create injects caller userId, stores a Decimal amount and null toAccountId', async () => {
      await service.create(A, validExpense);
      const arg = prismaMock.transaction.create.mock.calls[0][0];
      expect(arg.data.userId).toBe(A);
      expect(arg.data.toAccountId).toBeNull();
      expect(arg.data.amount).toBeInstanceOf(Prisma.Decimal);
    });
  });

  describe('validation', () => {
    it('rejects TRANSFER kind for now', async () => {
      await expect(
        service.create(A, { ...validExpense, kind: 'TRANSFER' as never }),
      ).rejects.toBeInstanceOf(NotImplementedException);
    });

    it('rejects amount <= 0, negative, or > 2 decimals', async () => {
      await expect(
        service.create(A, { ...validExpense, amount: '0' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.create(A, { ...validExpense, amount: '-5' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.create(A, { ...validExpense, amount: '1.234' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('EXPENSE requires an EXPENSE-kind owned category', async () => {
      await expect(
        service.create(A, { ...validExpense, categoryId: 'cat-inc-a' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('INCOME requires an INCOME-kind owned category', async () => {
      await expect(
        service.create(A, {
          ...validExpense,
          kind: 'INCOME' as never,
          categoryId: 'cat-exp-a',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.create(A, {
          ...validExpense,
          kind: 'INCOME' as never,
          categoryId: 'cat-inc-a',
        }),
      ).resolves.toMatchObject({ kind: 'INCOME' });
    });

    it("rejects an account that isn't the caller's", async () => {
      await expect(
        service.create(A, { ...validExpense, accountId: 'acc-b' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a category that isn't the caller's", async () => {
      await expect(
        service.create(A, { ...validExpense, categoryId: 'cat-b' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('pagination + filters', () => {
    it('returns a paginated envelope ordered date desc', async () => {
      const res = await service.findAll(A, {});
      expect(res).toMatchObject({ page: 1, pageSize: 20, total: 3 });
      expect(res.data.map((t) => t.id)).toEqual(['tx-a2', 'tx-a1', 'tx-a3']);
    });

    it('paginates with page/pageSize', async () => {
      const p1 = await service.findAll(A, { page: 1, pageSize: 2 });
      const p2 = await service.findAll(A, { page: 2, pageSize: 2 });
      expect(p1.data.map((t) => t.id)).toEqual(['tx-a2', 'tx-a1']);
      expect(p2.data.map((t) => t.id)).toEqual(['tx-a3']);
      expect(p1.total).toBe(3);
    });

    it('filters by account', async () => {
      const res = await service.findAll(A, { accountId: 'acc-a' });
      expect(res.data.map((t) => t.id)).toEqual(['tx-a1', 'tx-a3']);
      expect(res.total).toBe(2);
    });

    it('filters by date range', async () => {
      const res = await service.findAll(A, {
        from: '2026-06-08T00:00:00.000Z',
        to: '2026-06-15T00:00:00.000Z',
      });
      expect(res.data.map((t) => t.id)).toEqual(['tx-a1']);
    });
  });
});
