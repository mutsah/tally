import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ValuationsService } from './valuations.service';

// Mirrors the other isolation specs and adds valuation-specific validation
// (account-type rule, value >= 0, duplicate asOf). The delegate + account lookup
// are mocked over in-memory stores that honour the `where` clause.
describe('ValuationsService', () => {
  const A = 'user-a';
  const B = 'user-b';
  const D = (s: string) => new Prisma.Decimal(s);
  const dupError = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });

  let accounts: Array<Record<string, unknown>>;
  let store: Array<Record<string, unknown>>;
  let prismaMock: {
    accountValuation: Record<string, jest.Mock>;
    account: { findFirst: jest.Mock };
  };
  let service: ValuationsService;

  const matches = (
    row: Record<string, unknown>,
    where: Record<string, unknown> = {},
  ) => Object.entries(where).every(([k, v]) => row[k] === v);

  const sameDay = (a: unknown, b: unknown) =>
    (a as Date).getTime() === (b as Date).getTime();

  beforeEach(() => {
    accounts = [
      { id: 'inv-a', userId: A, type: 'INVESTMENT' },
      { id: 'loan-a', userId: A, type: 'MICROLOANS' },
      { id: 'bank-a', userId: A, type: 'BANK' },
      { id: 'inv-b', userId: B, type: 'INVESTMENT' },
    ];
    store = [
      {
        id: 'val-b',
        userId: B,
        accountId: 'inv-b',
        value: D('100.00'),
        asOf: new Date('2026-06-01'),
        note: null,
      },
    ];

    prismaMock = {
      accountValuation: {
        findMany: jest.fn(({ where }) =>
          Promise.resolve(store.filter((r) => matches(r, where))),
        ),
        findFirst: jest.fn(({ where }) =>
          Promise.resolve(store.find((r) => matches(r, where)) ?? null),
        ),
        create: jest.fn(({ data }) => {
          if (
            store.some(
              (r) =>
                r.accountId === data.accountId && sameDay(r.asOf, data.asOf),
            )
          ) {
            return Promise.reject(dupError());
          }
          const row = { id: `new-${store.length + 1}`, note: null, ...data };
          store.push(row);
          return Promise.resolve(row);
        }),
        updateMany: jest.fn(({ where, data }) => {
          const rows = store.filter((r) => matches(r, where));
          for (const r of rows) {
            const nextAsOf = data.asOf ?? r.asOf;
            if (
              store.some(
                (o) =>
                  o !== r &&
                  o.accountId === r.accountId &&
                  sameDay(o.asOf, nextAsOf),
              )
            ) {
              return Promise.reject(dupError());
            }
          }
          rows.forEach((r) => Object.assign(r, data));
          return Promise.resolve({ count: rows.length });
        }),
        deleteMany: jest.fn(({ where }) => {
          const before = store.length;
          store = store.filter((r) => !matches(r, where));
          return Promise.resolve({ count: before - store.length });
        }),
      },
      account: {
        findFirst: jest.fn(({ where }) =>
          Promise.resolve(
            accounts.find(
              (a) => a.id === where.id && a.userId === where.userId,
            ) ?? null,
          ),
        ),
      },
    };

    service = new ValuationsService(prismaMock as never);
  });

  const valid = {
    accountId: 'inv-a',
    value: '1500.00',
    asOf: '2026-06-30T00:00:00.000Z',
  };

  describe('tenant isolation', () => {
    it("list returns only the caller's valuations", async () => {
      await expect(service.findAll(A, {})).resolves.toEqual([]);
      await expect(service.findAll(B, {})).resolves.toHaveLength(1);
    });

    it("A cannot read B's valuation → 404; B can", async () => {
      await expect(service.findOne(A, 'val-b')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.findOne(B, 'val-b')).resolves.toMatchObject({
        id: 'val-b',
      });
    });

    it("A cannot update or delete B's valuation → 404", async () => {
      await expect(
        service.update(A, 'val-b', { value: '1.00' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.remove(A, 'val-b')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prismaMock.accountValuation.deleteMany).not.toHaveBeenCalled();
    });

    it('writes are scoped by BOTH id AND userId', async () => {
      await service.update(B, 'val-b', { value: '150.00' });
      expect(prismaMock.accountValuation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'val-b', userId: B } }),
      );
    });

    it('create injects the caller userId', async () => {
      await service.create(A, valid);
      expect(prismaMock.accountValuation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: A }),
        }),
      );
    });
  });

  describe('validation', () => {
    it('allows valuations on INVESTMENT and MICROLOANS accounts', async () => {
      await expect(service.create(A, valid)).resolves.toMatchObject({
        accountId: 'inv-a',
      });
      await expect(
        service.create(A, { ...valid, accountId: 'loan-a' }),
      ).resolves.toMatchObject({ accountId: 'loan-a' });
    });

    it('rejects a valuation on a CASH/BANK account', async () => {
      await expect(
        service.create(A, { ...valid, accountId: 'bank-a' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects an account that isn't the caller's", async () => {
      await expect(
        service.create(A, { ...valid, accountId: 'inv-b' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects negative or >2dp value, allows 0', async () => {
      await expect(
        service.create(A, { ...valid, value: '-5' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.create(A, { ...valid, value: '1.234' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.create(A, { ...valid, value: '0' }),
      ).resolves.toMatchObject({ accountId: 'inv-a' });
    });

    it('rejects a duplicate (accountId, asOf) → 409', async () => {
      await service.create(A, valid);
      await expect(service.create(A, valid)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rejects a PATCH asOf change that collides with another snapshot → 409', async () => {
      const first = await service.create(A, valid);
      const second = await service.create(A, {
        ...valid,
        asOf: '2026-07-31T00:00:00.000Z',
      });
      // Move the second onto the first's date → collision.
      await expect(
        service.update(A, second.id, { asOf: valid.asOf }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(first.id).not.toBe(second.id);
    });
  });
});
