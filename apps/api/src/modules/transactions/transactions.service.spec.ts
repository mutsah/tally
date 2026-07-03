import { BadRequestException, NotFoundException } from '@nestjs/common';
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
  ): boolean =>
    Object.entries(where).every(([k, v]) => {
      if (k === 'OR' && Array.isArray(v)) {
        return v.some((sub) =>
          matchesWhere(row, sub as Record<string, unknown>),
        );
      }
      if (k === 'NOT' && v && typeof v === 'object') {
        return !matchesWhere(row, v as Record<string, unknown>);
      }
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
      { id: 'acc-b2', userId: B },
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
          const row = { id: `new-${txStore.length + 1}`, ...data };
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

    it('filters by kind', async () => {
      // Seed one INCOME alongside A's three seeded EXPENSE rows.
      await service.create(A, {
        kind: 'INCOME' as never,
        amount: '100.00',
        date: '2026-06-15T00:00:00.000Z',
        accountId: 'acc-a',
        categoryId: 'cat-inc-a',
      });
      const income = await service.findAll(A, { kind: 'INCOME' as never });
      expect(income.total).toBe(1);
      expect(income.data.every((t) => t.kind === 'INCOME')).toBe(true);

      const expense = await service.findAll(A, { kind: 'EXPENSE' as never });
      expect(expense.total).toBe(3);
      expect(expense.data.every((t) => t.kind === 'EXPENSE')).toBe(true);
    });
  });

  describe('transfers (single-row model)', () => {
    const validTransfer = {
      kind: 'TRANSFER' as never,
      amount: '200.00',
      date: '2026-06-15T00:00:00.000Z',
      accountId: 'acc-a',
      toAccountId: 'acc-a2',
    };

    it('creates exactly ONE row with both accounts, no category, Decimal amount', async () => {
      const before = txStore.length;
      const res = await service.create(A, validTransfer);
      expect(prismaMock.transaction.create).toHaveBeenCalledTimes(1);
      expect(txStore.length).toBe(before + 1); // one row, not two
      expect(res).toMatchObject({
        kind: 'TRANSFER',
        accountId: 'acc-a',
        toAccountId: 'acc-a2',
        categoryId: null,
        userId: A,
      });
      expect(res.amount).toBeInstanceOf(Prisma.Decimal);
    });

    it('rejects a transfer without a destination', async () => {
      await expect(
        service.create(A, { ...validTransfer, toAccountId: undefined }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a transfer that carries a category', async () => {
      await expect(
        service.create(A, {
          ...validTransfer,
          categoryId: 'cat-exp-a',
        } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a transfer whose source equals its destination', async () => {
      await expect(
        service.create(A, { ...validTransfer, toAccountId: 'acc-a' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a transfer into an account that isn't the caller's", async () => {
      await expect(
        service.create(A, { ...validTransfer, toAccountId: 'acc-b' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects income/expense that carries a toAccountId (mirror case)', async () => {
      await expect(
        service.create(A, { ...validExpense, toAccountId: 'acc-a2' } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("isolation: A cannot read/update/delete B's transfer → 404", async () => {
      const bTransfer = await service.create(B, {
        kind: 'TRANSFER' as never,
        amount: '5.00',
        date: '2026-06-02T00:00:00.000Z',
        accountId: 'acc-b',
        toAccountId: 'acc-b2',
      });
      await expect(service.findOne(A, bTransfer.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(
        service.update(A, bTransfer.id, { amount: '6.00' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.remove(A, bTransfer.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('appears when filtering by EITHER the source or destination account', async () => {
      const transfer = await service.create(A, validTransfer);
      const bySource = await service.findAll(A, { accountId: 'acc-a' });
      const byDest = await service.findAll(A, { accountId: 'acc-a2' });
      expect(bySource.data.map((t) => t.id)).toContain(transfer.id);
      expect(byDest.data.map((t) => t.id)).toContain(transfer.id);
    });

    it('is movement, not spend/income: excluded from EXPENSE and INCOME subsets', async () => {
      const transfer = await service.create(A, validTransfer);
      await service.create(A, {
        kind: 'INCOME' as never,
        amount: '300.00',
        date: '2026-06-12T00:00:00.000Z',
        accountId: 'acc-a',
        categoryId: 'cat-inc-a',
      });

      const all = (await service.findAll(A, { pageSize: 100 })).data;
      const expenseIds = all
        .filter((t) => t.kind === 'EXPENSE')
        .map((t) => t.id);
      const incomeIds = all.filter((t) => t.kind === 'INCOME').map((t) => t.id);

      // The future dashboard sums by kind — the transfer must never appear in
      // either spend or income.
      expect(expenseIds).not.toContain(transfer.id);
      expect(incomeIds).not.toContain(transfer.id);
      expect(all.find((t) => t.id === transfer.id)?.kind).toBe('TRANSFER');
    });
  });

  describe('opening balances (starting balance for a derived account)', () => {
    const validOpening = {
      kind: 'OPENING' as never,
      amount: '1000.00',
      date: '2026-06-15T00:00:00.000Z',
      accountId: 'acc-a',
    };

    it('creates one row with the account, no category, no toAccount, Decimal amount', async () => {
      const before = txStore.length;
      const res = await service.create(A, validOpening);
      expect(prismaMock.transaction.create).toHaveBeenCalledTimes(1);
      expect(txStore.length).toBe(before + 1);
      expect(res).toMatchObject({
        kind: 'OPENING',
        accountId: 'acc-a',
        toAccountId: null,
        categoryId: null,
        userId: A,
      });
      expect(res.amount).toBeInstanceOf(Prisma.Decimal);
    });

    it('rejects an OPENING that carries a category', async () => {
      await expect(
        service.create(A, {
          ...validOpening,
          categoryId: 'cat-exp-a',
        } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an OPENING that carries a destination account', async () => {
      await expect(
        service.create(A, { ...validOpening, toAccountId: 'acc-a2' } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects an OPENING on an account that isn't the caller's", async () => {
      await expect(
        service.create(A, { ...validOpening, accountId: 'acc-b' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a non-positive amount (must be > 0, like every kind)', async () => {
      await expect(
        service.create(A, { ...validOpening, amount: '0' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows at most one OPENING per account (rejects a second)', async () => {
      await service.create(A, validOpening);
      await expect(service.create(A, validOpening)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejected at the DB constraint when the pre-check races (P2002 → clean 400, not a 500)', async () => {
      // Simulate a double-submit race: the pre-check sees no existing OPENING
      // (the concurrent insert is not yet visible), but the partial unique index
      // `transactions_accountId_opening_key` rejects the second insert with P2002.
      prismaMock.transaction.findFirst.mockResolvedValueOnce(null); // assertSingleOpening passes
      prismaMock.transaction.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['accountId'] },
        }),
      );
      await expect(service.create(A, validOpening)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('the one-per-account rule is scoped per account and per user', async () => {
      await service.create(A, validOpening); // acc-a
      // Same user, different account → allowed.
      await expect(
        service.create(A, { ...validOpening, accountId: 'acc-a2' }),
      ).resolves.toMatchObject({ kind: 'OPENING', accountId: 'acc-a2' });
      // Different user opening their own account → allowed (scoped by userId).
      await expect(
        service.create(B, { ...validOpening, accountId: 'acc-b' }),
      ).resolves.toMatchObject({ kind: 'OPENING', userId: B });
    });

    it('is movement-like, à la TRANSFER: excluded from EXPENSE and INCOME subsets', async () => {
      const opening = await service.create(A, validOpening);
      const all = (await service.findAll(A, { pageSize: 100 })).data;
      const expenseIds = all
        .filter((t) => t.kind === 'EXPENSE')
        .map((t) => t.id);
      const incomeIds = all.filter((t) => t.kind === 'INCOME').map((t) => t.id);
      expect(expenseIds).not.toContain(opening.id);
      expect(incomeIds).not.toContain(opening.id);
      expect(all.find((t) => t.id === opening.id)?.kind).toBe('OPENING');
    });
  });
});
