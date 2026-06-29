import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CategoryKind } from '@prisma/client';
import { CategoriesService } from './categories.service';

// Mirrors the Accounts isolation spec: proves a second user can never
// read/list/update/delete the first user's categories, and additionally covers
// the one-level-nesting and same-kind-parent rules. The Prisma delegate is
// mocked over an in-memory store that honours the `where` clause, so the userId
// scoping is genuinely exercised.
describe('CategoriesService', () => {
  const USER_A = 'user-a';
  const USER_B = 'user-b';

  // A: a top-level "Food" (EXPENSE) with one child "Groceries".
  const A_PARENT = 'a-parent';
  const A_CHILD = 'a-child';
  // B: a top-level "B Rent" (EXPENSE).
  const B_CAT = 'b-cat';

  let store: Array<Record<string, unknown>>;
  let service: CategoriesService;
  let prismaMock: { category: Record<string, jest.Mock> };

  const matches = (
    row: Record<string, unknown>,
    where: Record<string, unknown>,
  ) => Object.entries(where).every(([k, v]) => row[k] === v);

  beforeEach(() => {
    store = [
      {
        id: A_PARENT,
        userId: USER_A,
        name: 'Food',
        kind: CategoryKind.EXPENSE,
        parentId: null,
      },
      {
        id: A_CHILD,
        userId: USER_A,
        name: 'Groceries',
        kind: CategoryKind.EXPENSE,
        parentId: A_PARENT,
      },
      {
        id: B_CAT,
        userId: USER_B,
        name: 'B Rent',
        kind: CategoryKind.EXPENSE,
        parentId: null,
      },
    ];

    prismaMock = {
      category: {
        findMany: jest.fn(({ where }) =>
          Promise.resolve(store.filter((r) => matches(r, where))),
        ),
        findFirst: jest.fn(({ where }) =>
          Promise.resolve(store.find((r) => matches(r, where)) ?? null),
        ),
        create: jest.fn(({ data }) => {
          const row = { id: 'new-id', ...data };
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

    service = new CategoriesService(prismaMock as never);
  });

  describe('tenant isolation', () => {
    it("list returns only the caller's own categories", async () => {
      const aList = await service.findAll(USER_A);
      const bList = await service.findAll(USER_B);
      expect(aList.map((c) => c.id).sort()).toEqual([A_CHILD, A_PARENT].sort());
      expect(bList.map((c) => c.id)).toEqual([B_CAT]);
    });

    it('list orders children directly under their parent', async () => {
      const aList = await service.findAll(USER_A);
      expect(aList.map((c) => c.id)).toEqual([A_PARENT, A_CHILD]);
    });

    it("A cannot read B's category → 404; B can", async () => {
      await expect(service.findOne(USER_A, B_CAT)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.findOne(USER_B, B_CAT)).resolves.toMatchObject({
        id: B_CAT,
      });
    });

    it("A cannot update B's category → 404, B's row untouched", async () => {
      await expect(
        service.update(USER_A, B_CAT, { name: 'hijacked' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(store.find((r) => r.id === B_CAT)?.name).toBe('B Rent');
    });

    it("A cannot delete B's category → 404, B's row remains", async () => {
      await expect(service.remove(USER_A, B_CAT)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(store.find((r) => r.id === B_CAT)).toBeDefined();
      expect(prismaMock.category.deleteMany).not.toHaveBeenCalled();
    });

    it('writes are scoped by BOTH id AND userId', async () => {
      await service.update(USER_B, B_CAT, { name: 'B Renamed' });
      expect(prismaMock.category.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: B_CAT, userId: USER_B } }),
      );
    });

    it('create injects the caller userId', async () => {
      await service.create(USER_A, {
        name: 'Salary',
        kind: CategoryKind.INCOME,
      });
      expect(prismaMock.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: USER_A }),
        }),
      );
    });
  });

  describe('one-level nesting + same-kind parent', () => {
    it('rejects creating a child under another child', async () => {
      await expect(
        service.create(USER_A, {
          name: 'Snacks',
          kind: CategoryKind.EXPENSE,
          parentId: A_CHILD,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a parent of a different kind', async () => {
      await expect(
        service.create(USER_A, {
          name: 'Bonus',
          kind: CategoryKind.INCOME,
          parentId: A_PARENT,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows a valid child under a top-level parent of the same kind', async () => {
      const child = await service.create(USER_A, {
        name: 'Takeaway',
        kind: CategoryKind.EXPENSE,
        parentId: A_PARENT,
      });
      expect(child).toMatchObject({ parentId: A_PARENT, userId: USER_A });
    });

    it('rejects re-parenting a category that has its own children', async () => {
      await expect(
        service.update(USER_A, A_PARENT, { parentId: A_CHILD }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a duplicate sibling name (incl. top-level NULL parent)', async () => {
      await expect(
        service.create(USER_A, { name: 'Food', kind: CategoryKind.EXPENSE }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
