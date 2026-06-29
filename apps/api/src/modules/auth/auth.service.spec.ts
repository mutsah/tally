import { CategoryKind } from '@prisma/client';
import { AuthService } from './auth.service';
import { STARTER_CATEGORIES } from 'src/modules/categories/starter-categories';

// Proves registration seeds the starter categories transactionally: the user
// and all 14 categories are created inside a single prisma.$transaction, so a
// seeding failure rolls the user back too.
describe('AuthService.register — transactional category seeding', () => {
  const NEW_USER = {
    id: 'u1',
    email: 'new@example.com',
    firstName: 'New',
    lastName: 'User',
    role: 'USER',
  };

  let tx: { user: { create: jest.Mock }; category: { createMany: jest.Mock } };
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: AuthService;

  beforeEach(() => {
    tx = {
      user: { create: jest.fn().mockResolvedValue(NEW_USER) },
      category: { createMany: jest.fn().mockResolvedValue({ count: 14 }) },
    };
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((cb) => cb(tx)),
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
    const mail = {};
    const config = { get: jest.fn().mockReturnValue('test-secret') };

    service = new AuthService(
      prisma as never,
      jwt as never,
      mail as never,
      config as never,
    );
  });

  it('creates the user and seeds categories in one transaction', async () => {
    const result = await service.register({
      email: NEW_USER.email,
      password: 'P@ssw0rd1',
      firstName: NEW_USER.firstName,
      lastName: NEW_USER.lastName,
    });

    expect(result.user.id).toBe('u1');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // Both the user and the categories are created on the SAME tx client.
    expect(tx.user.create).toHaveBeenCalledTimes(1);
    expect(tx.category.createMany).toHaveBeenCalledTimes(1);
  });

  it('seeds exactly the 14 starter categories owned by the new user', async () => {
    await service.register({
      email: NEW_USER.email,
      password: 'P@ssw0rd1',
      firstName: NEW_USER.firstName,
      lastName: NEW_USER.lastName,
    });

    const arg = tx.category.createMany.mock.calls[0][0];
    expect(arg.data).toHaveLength(14);
    expect(arg.data.every((c: { userId: string }) => c.userId === 'u1')).toBe(
      true,
    );
    expect(
      arg.data.filter((c: { kind: CategoryKind }) => c.kind === 'EXPENSE'),
    ).toHaveLength(10);
    expect(
      arg.data.filter((c: { kind: CategoryKind }) => c.kind === 'INCOME'),
    ).toHaveLength(4);
  });
});

describe('STARTER_CATEGORIES', () => {
  it('has 14 unique top-level entries (10 expense + 4 income)', () => {
    expect(STARTER_CATEGORIES).toHaveLength(14);
    expect(
      STARTER_CATEGORIES.filter((c) => c.kind === CategoryKind.EXPENSE),
    ).toHaveLength(10);
    expect(
      STARTER_CATEGORIES.filter((c) => c.kind === CategoryKind.INCOME),
    ).toHaveLength(4);
    const names = STARTER_CATEGORIES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
