import { Prisma } from '@prisma/client';
import { AccountsService } from './accounts.service';

// Balance computation: derived accounts (CASH/BANK) sum transaction flow with
// transfers read once on each side; valued accounts (INVESTMENT/MICROLOANS)
// ignore transactions and take the LATEST valuation snapshot by asOf ("0.00"
// only when none exists). Decimal-safe, string out. The transaction.groupBy and
// accountValuation.findMany mocks compute real, userId-scoped results.
describe('AccountsService — balance computation', () => {
  const A = 'user-a';
  const B = 'user-b';
  const D = (s: string) => new Prisma.Decimal(s);

  let accounts: Array<Record<string, unknown>>;
  let txns: Array<Record<string, unknown>>;
  let valuations: Array<Record<string, unknown>>;
  let service: AccountsService;

  beforeEach(() => {
    accounts = [
      {
        id: 'acc1',
        userId: A,
        name: 'Checking',
        type: 'BANK',
        archived: false,
      },
      { id: 'acc2', userId: A, name: 'Savings', type: 'BANK', archived: false },
      { id: 'acc3', userId: A, name: 'Wallet', type: 'CASH', archived: false },
      {
        id: 'acc4',
        userId: A,
        name: 'Brokerage',
        type: 'INVESTMENT',
        archived: false,
      },
      { id: 'acc5', userId: A, name: 'Tips', type: 'CASH', archived: false },
      // Valued account with NO valuation → "0.00".
      {
        id: 'acc6',
        userId: A,
        name: 'Loan',
        type: 'MICROLOANS',
        archived: false,
      },
      { id: 'accB', userId: B, name: 'B Bank', type: 'BANK', archived: false },
    ];
    txns = [
      {
        userId: A,
        kind: 'INCOME',
        amount: D('1000.00'),
        accountId: 'acc1',
        toAccountId: null,
      },
      {
        userId: A,
        kind: 'EXPENSE',
        amount: D('250.50'),
        accountId: 'acc1',
        toAccountId: null,
      },
      {
        userId: A,
        kind: 'TRANSFER',
        amount: D('100.00'),
        accountId: 'acc1',
        toAccountId: 'acc2',
      },
      // Income on a VALUED account — must be ignored by the balance.
      {
        userId: A,
        kind: 'INCOME',
        amount: D('500.00'),
        accountId: 'acc4',
        toAccountId: null,
      },
      // 0.10 + 0.20 — proves Decimal exactness (no float drift to 0.30000000…4).
      {
        userId: A,
        kind: 'INCOME',
        amount: D('0.10'),
        accountId: 'acc5',
        toAccountId: null,
      },
      {
        userId: A,
        kind: 'INCOME',
        amount: D('0.20'),
        accountId: 'acc5',
        toAccountId: null,
      },
      // Another user's transaction referencing acc1 — must NEVER affect A.
      {
        userId: B,
        kind: 'INCOME',
        amount: D('9999.00'),
        accountId: 'acc1',
        toAccountId: null,
      },
    ];

    // acc4 (INVESTMENT) has two snapshots; the LATEST by asOf (1500.00) wins.
    // The older one is listed LAST to prove it's max-by-asOf, not last-inserted.
    valuations = [
      {
        userId: A,
        accountId: 'acc4',
        value: D('1500.00'),
        asOf: new Date('2026-06-20'),
      },
      {
        userId: A,
        accountId: 'acc4',
        value: D('1200.00'),
        asOf: new Date('2026-06-10'),
      },
      // Another user's valuation on acc4 — must NEVER affect A.
      {
        userId: B,
        accountId: 'acc4',
        value: D('99999.00'),
        asOf: new Date('2026-06-25'),
      },
    ];

    const prismaMock = {
      account: {
        findMany: jest.fn(({ where }) =>
          Promise.resolve(accounts.filter((a) => a.userId === where.userId)),
        ),
        findFirst: jest.fn(({ where }) =>
          Promise.resolve(
            accounts.find(
              (a) => a.id === where.id && a.userId === where.userId,
            ) ?? null,
          ),
        ),
      },
      transaction: {
        groupBy: jest.fn(({ by, where }) => {
          const rows = txns.filter(
            (t) =>
              t.userId === where.userId &&
              (where.kind ? t.kind === where.kind : true),
          );
          const groups = new Map<string, Record<string, unknown>>();
          if (by.includes('toAccountId')) {
            for (const t of rows) {
              if (!t.toAccountId) continue;
              const key = t.toAccountId as string;
              const g =
                groups.get(key) ??
                ({ toAccountId: key, _sum: { amount: D('0') } } as never);
              (g as { _sum: { amount: Prisma.Decimal } })._sum.amount = (
                g as { _sum: { amount: Prisma.Decimal } }
              )._sum.amount.plus(t.amount as Prisma.Decimal);
              groups.set(key, g);
            }
          } else {
            for (const t of rows) {
              const key = `${t.accountId}|${t.kind}`;
              const g =
                groups.get(key) ??
                ({
                  accountId: t.accountId,
                  kind: t.kind,
                  _sum: { amount: D('0') },
                } as never);
              (g as { _sum: { amount: Prisma.Decimal } })._sum.amount = (
                g as { _sum: { amount: Prisma.Decimal } }
              )._sum.amount.plus(t.amount as Prisma.Decimal);
              groups.set(key, g);
            }
          }
          return Promise.resolve([...groups.values()]);
        }),
      },
      accountValuation: {
        findMany: jest.fn(({ where, distinct, orderBy }) => {
          const ids: string[] = where.accountId?.in ?? [];
          let rows = valuations.filter(
            (v) =>
              v.userId === where.userId && ids.includes(v.accountId as string),
          );
          // orderBy [{ accountId: 'asc' }, { asOf: 'desc' }]
          rows = [...rows].sort((a, b) => {
            if (a.accountId !== b.accountId)
              return (a.accountId as string) < (b.accountId as string) ? -1 : 1;
            return (b.asOf as Date).getTime() - (a.asOf as Date).getTime();
          });
          if (distinct?.includes('accountId')) {
            const seen = new Set<string>();
            rows = rows.filter((v) => {
              if (seen.has(v.accountId as string)) return false;
              seen.add(v.accountId as string);
              return true;
            });
          }
          return Promise.resolve(
            rows.map((v) => ({ accountId: v.accountId, value: v.value })),
          );
        }),
      },
    };

    service = new AccountsService(prismaMock as never);
  });

  const balancesById = async (userId: string) => {
    const list = await service.findAll(userId);
    return Object.fromEntries(list.map((a) => [a.id, a.balance]));
  };

  it('derived balance = income + transfers in − expense − transfers out', async () => {
    const b = await balancesById(A);
    // acc1: 1000.00 − 250.50 − 100.00(transfer out) = 649.50
    expect(b.acc1).toBe('649.50');
  });

  it('a transfer subtracts from source AND adds to destination (one row, both sides)', async () => {
    const b = await balancesById(A);
    expect(b.acc1).toBe('649.50'); // source reflects the −100.00
    expect(b.acc2).toBe('100.00'); // destination reflects the +100.00
  });

  it('an account with no transactions is "0.00"', async () => {
    const b = await balancesById(A);
    expect(b.acc3).toBe('0.00');
  });

  it('a VALUED account returns its LATEST valuation snapshot, not transactions', async () => {
    const b = await balancesById(A);
    // acc4 (INVESTMENT) has a 500.00 income on it AND snapshots 1500/1200.
    // Balance = latest snapshot (1500.00); the transaction is NOT summed.
    expect(b.acc4).toBe('1500.00');
  });

  it('uses the greatest asOf snapshot (not the last inserted)', async () => {
    // 1500.00 is asOf 2026-06-20; 1200.00 (asOf 2026-06-10) is inserted after it.
    const b = await balancesById(A);
    expect(b.acc4).toBe('1500.00');
  });

  it('a VALUED account with NO valuations is "0.00"', async () => {
    const b = await balancesById(A);
    expect(b.acc6).toBe('0.00'); // MICROLOANS, no snapshot
  });

  it("another user's valuations never affect this user's balance", async () => {
    // B has a 99999.00 valuation on acc4 (asOf 2026-06-25, the greatest) — must
    // be excluded because acc4 is A's and the query is userId-scoped.
    const b = await balancesById(A);
    expect(b.acc4).toBe('1500.00');
  });

  it('is decimal-exact (0.10 + 0.20 = "0.30", no float drift)', async () => {
    const b = await balancesById(A);
    expect(b.acc5).toBe('0.30');
  });

  it("only sums the caller's own transactions (isolation)", async () => {
    const b = await balancesById(A);
    // B's 9999.00 income references acc1 but belongs to user B → excluded.
    expect(b.acc1).toBe('649.50');
    // And B's own listing never includes A's accounts.
    const bList = await service.findAll(B);
    expect(bList.map((a) => a.id)).toEqual(['accB']);
    expect(bList[0].balance).toBe('0.00');
  });

  it('an OPENING contributes to a derived balance exactly like income', async () => {
    // acc3 (Wallet, CASH) has no other flow → its balance is the OPENING.
    txns.push({
      userId: A,
      kind: 'OPENING',
      amount: D('500.00'),
      accountId: 'acc3',
      toAccountId: null,
    });
    const b = await balancesById(A);
    expect(b.acc3).toBe('500.00');
  });

  it('OPENING stacks with income/expense/transfers on the same account', async () => {
    // acc1 is 649.50 from flow; a 200.00 OPENING adds like income → 849.50.
    txns.push({
      userId: A,
      kind: 'OPENING',
      amount: D('200.00'),
      accountId: 'acc1',
      toAccountId: null,
    });
    const b = await balancesById(A);
    expect(b.acc1).toBe('849.50');
  });

  it('balance is a string, and findOne includes it too', async () => {
    const b = await balancesById(A);
    expect(typeof b.acc1).toBe('string');
    const one = await service.findOne(A, 'acc1');
    expect(one.balance).toBe('649.50');
    expect(typeof one.balance).toBe('string');
  });
});
