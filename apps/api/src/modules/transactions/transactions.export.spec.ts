import { Prisma } from '@prisma/client';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';

// CSV export: exact 2-dp amount strings (no float/locale), RFC 4180 escaping,
// transfer vs income/expense column handling, filters, userId scoping, and the
// download headers. The findMany mock honours `where` over a seeded store.
describe('Transactions CSV export', () => {
  const A = 'user-a';
  const B = 'user-b';
  const D = (s: string) => new Prisma.Decimal(s);
  const dt = (s: string) => new Date(`${s}T00:00:00.000Z`);

  let txns: Array<Record<string, unknown>>;
  let prismaMock: { transaction: { findMany: jest.Mock } };
  let service: TransactionsService;

  const matchWhere = (
    t: Record<string, unknown>,
    where: Record<string, unknown>,
  ): boolean =>
    Object.entries(where).every(([k, v]) => {
      if (k === 'OR' && Array.isArray(v)) {
        return v.some((sub) => matchWhere(t, sub as Record<string, unknown>));
      }
      if (k === 'date' && v && typeof v === 'object') {
        const r = v as { gte?: Date; lte?: Date };
        const d = t.date as Date;
        if (r.gte && d < r.gte) return false;
        if (r.lte && d > r.lte) return false;
        return true;
      }
      return t[k] === v;
    });

  // An income/expense row with an overridable note.
  const expense = (over: Record<string, unknown>) => ({
    userId: A,
    kind: 'EXPENSE',
    amount: D('5.00'),
    date: dt('2026-06-10'),
    accountId: 'acc1',
    toAccountId: null,
    categoryId: 'cat1',
    account: { name: 'Checking' },
    toAccount: null,
    category: { name: 'Food' },
    note: null,
    ...over,
  });

  beforeEach(() => {
    txns = [
      expense({
        id: 't1',
        amount: D('1250'),
        date: dt('2026-06-10'),
        note: 'lunch',
      }),
      {
        id: 't2',
        userId: A,
        kind: 'TRANSFER',
        amount: D('100'),
        date: dt('2026-06-12'),
        accountId: 'acc1',
        toAccountId: 'acc2',
        categoryId: null,
        account: { name: 'Checking' },
        toAccount: { name: 'Savings' },
        category: null,
        note: null,
      },
      // Another user's transaction — must never appear.
      expense({
        id: 'tb',
        userId: B,
        amount: D('9999'),
        date: dt('2026-06-09'),
        account: { name: 'B Acc' },
        category: { name: 'B Cat' },
      }),
    ];

    prismaMock = {
      transaction: {
        findMany: jest.fn(({ where }) => {
          const rows = txns
            .filter((t) => matchWhere(t, where))
            .sort(
              (a, b) => (b.date as Date).getTime() - (a.date as Date).getTime(),
            );
          return Promise.resolve(rows);
        }),
      },
    };
    service = new TransactionsService(prismaMock as never);
  });

  const lines = (csv: string) => csv.split('\r\n');

  it('emits the header and exact 2-dp amount strings (no float/locale)', async () => {
    const csv = await service.exportCsv(A, {});
    const l = lines(csv);
    expect(l[0]).toBe('date,kind,amount,account,toAccount,category,note');
    // Newest first: the transfer (06-12) then the expense (06-10).
    expect(l[2]).toBe('2026-06-10,EXPENSE,1250.00,Checking,,Food,lunch');
    expect(csv).not.toContain('1,250'); // no thousands separator
  });

  it('income/expense vs transfer column handling', async () => {
    const l = lines(await service.exportCsv(A, {}));
    // Transfer: both accounts populated, category empty.
    expect(l[1]).toBe('2026-06-12,TRANSFER,100.00,Checking,Savings,,');
    // Expense: toAccount empty, category populated.
    expect(l[2]).toBe('2026-06-10,EXPENSE,1250.00,Checking,,Food,lunch');
  });

  describe('RFC 4180 escaping', () => {
    it('quotes a note containing a comma', async () => {
      txns = [expense({ id: 'c', note: 'coffee, tea' })];
      const l = lines(await service.exportCsv(A, {}));
      expect(l[1]).toBe('2026-06-10,EXPENSE,5.00,Checking,,Food,"coffee, tea"');
    });

    it('doubles embedded double-quotes', async () => {
      txns = [expense({ id: 'q', note: 'say "hi"' })];
      const l = lines(await service.exportCsv(A, {}));
      expect(l[1]).toBe('2026-06-10,EXPENSE,5.00,Checking,,Food,"say ""hi"""');
    });

    it('quotes a note containing a newline without breaking the record', async () => {
      txns = [expense({ id: 'n', note: 'line1\nline2' })];
      const csv = await service.exportCsv(A, {});
      // Splitting on the CRLF record separator keeps the embedded LF intact.
      const l = lines(csv);
      expect(l).toHaveLength(2);
      expect(l[1]).toBe(
        '2026-06-10,EXPENSE,5.00,Checking,,Food,"line1\nline2"',
      );
    });
  });

  it('applies the accountId filter (and is userId-scoped)', async () => {
    const csv = await service.exportCsv(A, { accountId: 'acc2' });
    const l = lines(csv);
    // Only the transfer touches acc2 (as destination); B's row never appears.
    expect(l).toHaveLength(2);
    expect(l[1]).toContain('TRANSFER');
    expect(csv).not.toContain('9999');
  });

  it('applies a date range filter', async () => {
    const csv = await service.exportCsv(A, {
      from: '2026-06-11T00:00:00.000Z',
      to: '2026-06-13T00:00:00.000Z',
    });
    const l = lines(csv);
    expect(l).toHaveLength(2);
    expect(l[1]).toContain('TRANSFER'); // only the 06-12 transfer is in range
  });

  it('applies the kind filter (export mirrors the list)', async () => {
    const csv = await service.exportCsv(A, { kind: 'TRANSFER' as never });
    const l = lines(csv);
    // Only the transfer row (plus header); the expense is filtered out.
    expect(l).toHaveLength(2);
    expect(l[1]).toContain('TRANSFER');
    expect(csv).not.toContain('EXPENSE');
  });

  it('an empty result set is a header-only CSV', async () => {
    const csv = await service.exportCsv(A, { accountId: 'nope' });
    expect(csv).toBe('date,kind,amount,account,toAccount,category,note');
  });

  it('sets text/csv and an attachment Content-Disposition', async () => {
    const controller = new TransactionsController({
      exportCsv: jest.fn().mockResolvedValue('CSV-BODY'),
    } as never);
    const res = { set: jest.fn(), send: jest.fn() };
    await controller.exportCsv(A, {}, res as never);
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': expect.stringMatching(
          /^attachment; filename="tally-transactions-\d{4}-\d{2}-\d{2}\.csv"$/,
        ),
      }),
    );
    expect(res.send).toHaveBeenCalledWith('CSV-BODY');
  });
});
