import { NotFoundException } from '@nestjs/common';
import { AccountsService } from './accounts.service';

// Proves the per-user tenant isolation invariant for the Accounts module:
// a second user can never read, list, update, or delete the first user's rows.
// The Prisma delegate is mocked over a tiny in-memory store that honours the
// `where` clause, so it actually exercises the userId scoping the service relies
// on (not just that a method was called).
describe('AccountsService — tenant isolation', () => {
  const USER_A = 'user-a';
  const USER_B = 'user-b';
  const B_ACCOUNT_ID = 'acct-b-1';

  let store: Array<Record<string, unknown>>;
  let service: AccountsService;
  let prismaMock: { account: Record<string, jest.Mock> };

  const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => row[k] === v);

  beforeEach(() => {
    store = [
      {
        id: B_ACCOUNT_ID,
        userId: USER_B,
        name: 'B Savings',
        type: 'CASH',
        archived: false,
      },
    ];

    prismaMock = {
      account: {
        findMany: jest.fn(({ where }) =>
          Promise.resolve(store.filter((r) => matches(r, where))),
        ),
        findFirst: jest.fn(({ where }) =>
          Promise.resolve(store.find((r) => matches(r, where)) ?? null),
        ),
        create: jest.fn(({ data }) => {
          const row = { id: 'new-id', archived: false, ...data };
          store.push(row);
          return Promise.resolve(row);
        }),
        updateMany: jest.fn(({ where, data }) => {
          const rows = store.filter((r) => matches(r, where));
          rows.forEach((r) => Object.assign(r, data));
          return Promise.resolve({ count: rows.length });
        }),
        deleteMany: jest.fn(({ where }) => {
          const before = store.length;
          store = store.filter((r) => !matches(r, where));
          return Promise.resolve({ count: before - store.length });
        }),
      },
    };

    service = new AccountsService(prismaMock as never);
  });

  it("list returns only the caller's own accounts", async () => {
    await expect(service.findAll(USER_A)).resolves.toEqual([]);
    await expect(service.findAll(USER_B)).resolves.toHaveLength(1);
  });

  it("A cannot read B's account → 404; B can", async () => {
    await expect(service.findOne(USER_A, B_ACCOUNT_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.findOne(USER_B, B_ACCOUNT_ID)).resolves.toMatchObject({
      id: B_ACCOUNT_ID,
    });
  });

  it("A cannot update B's account → 404, and B's row is untouched", async () => {
    await expect(
      service.update(USER_A, B_ACCOUNT_ID, { name: 'hijacked' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(store.find((r) => r.id === B_ACCOUNT_ID)?.name).toBe('B Savings');
  });

  it("A cannot delete B's account → 404, and B's row remains", async () => {
    await expect(service.remove(USER_A, B_ACCOUNT_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(store.find((r) => r.id === B_ACCOUNT_ID)).toBeDefined();
    expect(prismaMock.account.deleteMany).not.toHaveBeenCalled();
  });

  it('writes are scoped by BOTH id AND userId', async () => {
    await service.update(USER_B, B_ACCOUNT_ID, { name: 'B Renamed' });
    expect(prismaMock.account.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: B_ACCOUNT_ID, userId: USER_B },
      }),
    );
  });

  it('create injects the caller userId (not client-supplied)', async () => {
    await service.create(USER_A, { name: 'A Checking', type: 'BANK' as never });
    expect(prismaMock.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: USER_A }),
      }),
    );
  });
});
