import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Transaction, TransactionKind } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  TenantDelegate,
  TenantScopedService,
} from 'src/common/services/tenant-scoped.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { ExportTransactionsQueryDto } from './dto/export-transactions-query.dto';
import { toCsv } from 'src/common/utils/csv';

export interface PaginatedTransactions {
  data: Transaction[];
  page: number;
  pageSize: number;
  total: number;
}

/** Normalized relational fields after invariant validation. */
interface ResolvedRelations {
  toAccountId: string | null;
  categoryId: string | null;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class TransactionsService extends TenantScopedService<Transaction> {
  protected readonly entityName = 'Transaction';

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  protected get delegate(): TenantDelegate {
    return this.prisma.transaction as unknown as TenantDelegate;
  }

  async create(
    userId: string,
    dto: CreateTransactionDto,
  ): Promise<Transaction> {
    const amount = this.parseAmount(dto.amount);
    const relations = await this.validateRelations(
      userId,
      dto.kind,
      dto.accountId,
      dto.toAccountId ?? null,
      dto.categoryId ?? null,
    );

    return this.createForUser(userId, {
      kind: dto.kind,
      amount,
      date: new Date(dto.date),
      note: dto.note ?? null,
      accountId: dto.accountId,
      toAccountId: relations.toAccountId,
      categoryId: relations.categoryId,
    });
  }

  async findAll(
    userId: string,
    query: ListTransactionsQueryDto,
  ): Promise<PaginatedTransactions> {
    const page = query.page ?? 1;
    const pageSize = Math.min(
      query.pageSize ?? DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    );
    const where = this.buildFilter(query);

    const [data, total] = await Promise.all([
      this.listForUser(userId, {
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.countForUser(userId, where),
    ]);

    return { data, page, pageSize, total };
  }

  /**
   * The full filtered set (no pagination) as an RFC 4180 CSV string, date desc,
   * scoped to the user. Amounts are exact 2-dp strings (Prisma.Decimal.toFixed,
   * no float, no locale). Columns: date, kind, amount, account, toAccount,
   * category, note. Transfers carry both accounts and no category;
   * income/expense carry a category and no toAccount.
   */
  async exportCsv(
    userId: string,
    query: ExportTransactionsQueryDto,
  ): Promise<string> {
    const where = this.buildFilter(query);
    const txns = await this.prisma.transaction.findMany({
      where: { ...where, userId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        account: { select: { name: true } },
        toAccount: { select: { name: true } },
        category: { select: { name: true } },
      },
    });

    const header = [
      'date',
      'kind',
      'amount',
      'account',
      'toAccount',
      'category',
      'note',
    ];
    const rows = txns.map((t) => [
      t.date.toISOString().slice(0, 10),
      t.kind,
      t.amount.toFixed(2),
      t.account?.name ?? '',
      t.toAccount?.name ?? '',
      t.category?.name ?? '',
      t.note ?? '',
    ]);
    return toCsv(header, rows);
  }

  findOne(userId: string, id: string): Promise<Transaction> {
    return this.getForUser(userId, id);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<Transaction> {
    const current = await this.getForUser(userId, id);
    const data: Record<string, unknown> = {};

    if (dto.amount !== undefined) {
      data.amount = this.parseAmount(dto.amount);
    }
    if (dto.date !== undefined) {
      data.date = new Date(dto.date);
    }
    if (dto.note !== undefined) {
      data.note = dto.note; // null clears the note
    }

    // If any relational field is touched, re-validate the WHOLE record against
    // its (immutable) kind so it stays valid — a transfer can't gain a category
    // or drop its destination, income/expense can't gain a destination, etc.
    const relationsTouched =
      dto.accountId !== undefined ||
      dto.toAccountId !== undefined ||
      dto.categoryId !== undefined;

    if (relationsTouched) {
      const accountId = dto.accountId ?? current.accountId;
      const toAccountId =
        dto.toAccountId !== undefined
          ? (dto.toAccountId ?? null)
          : current.toAccountId;
      const categoryId =
        dto.categoryId !== undefined
          ? (dto.categoryId ?? null)
          : current.categoryId;

      const relations = await this.validateRelations(
        userId,
        current.kind,
        accountId,
        toAccountId,
        categoryId,
      );

      if (dto.accountId !== undefined) {
        data.accountId = accountId;
      }
      if (dto.toAccountId !== undefined) {
        data.toAccountId = relations.toAccountId;
      }
      if (dto.categoryId !== undefined) {
        data.categoryId = relations.categoryId;
      }
    }

    if (Object.keys(data).length === 0) {
      return current;
    }

    return this.updateForUser(userId, id, data);
  }

  remove(userId: string, id: string): Promise<Transaction> {
    return this.deleteForUser(userId, id);
  }

  private buildFilter(
    query: ListTransactionsQueryDto,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    if (query.accountId) {
      // A transfer touches two accounts, so it must surface when filtering by
      // EITHER its source or its destination account.
      where.OR = [
        { accountId: query.accountId },
        { toAccountId: query.accountId },
      ];
    }
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.from || query.to) {
      const range: { gte?: Date; lte?: Date } = {};
      if (query.from) {
        range.gte = new Date(query.from);
      }
      if (query.to) {
        range.lte = new Date(query.to);
      }
      where.date = range;
    }
    return where;
  }

  /**
   * The single cross-field validation path for every kind. Returns the
   * normalized (toAccountId, categoryId) to persist so an invalid mix can't be
   * stored:
   *   INCOME/EXPENSE → categoryId required (owned, matching kind), toAccountId null.
   *   TRANSFER       → toAccountId required (owned, ≠ source), categoryId null.
   */
  private async validateRelations(
    userId: string,
    kind: TransactionKind,
    accountId: string,
    toAccountId: string | null,
    categoryId: string | null,
  ): Promise<ResolvedRelations> {
    await this.assertAccountOwned(userId, accountId, 'accountId');

    if (kind === TransactionKind.TRANSFER) {
      if (!toAccountId) {
        throw new BadRequestException(
          'A transfer requires a destination account (toAccountId)',
        );
      }
      if (categoryId) {
        throw new BadRequestException('A transfer cannot have a category');
      }
      if (toAccountId === accountId) {
        throw new BadRequestException(
          'A transfer source and destination must be different accounts',
        );
      }
      await this.assertAccountOwned(userId, toAccountId, 'toAccountId');
      return { toAccountId, categoryId: null };
    }

    // INCOME or EXPENSE
    if (toAccountId) {
      throw new BadRequestException(
        'An income/expense transaction cannot have a destination account (toAccountId)',
      );
    }
    if (!categoryId) {
      throw new BadRequestException(
        `A ${kind} transaction requires a category`,
      );
    }
    await this.assertCategoryMatchesKind(userId, categoryId, kind);
    return { toAccountId: null, categoryId };
  }

  /** Parse + validate a money string into a positive, ≤2dp Decimal (no floats). */
  private parseAmount(value: string): Prisma.Decimal {
    let amount: Prisma.Decimal;
    try {
      amount = new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException('amount is not a valid number');
    }
    if (!amount.isFinite() || amount.lte(0)) {
      throw new BadRequestException('amount must be greater than 0');
    }
    if (amount.decimalPlaces() > 2) {
      throw new BadRequestException(
        'amount must have at most 2 decimal places',
      );
    }
    return amount;
  }

  private async assertAccountOwned(
    userId: string,
    accountId: string,
    field: 'accountId' | 'toAccountId',
  ): Promise<void> {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    });
    if (!account) {
      throw new BadRequestException(
        `${field} does not reference one of your accounts`,
      );
    }
  }

  private async assertCategoryMatchesKind(
    userId: string,
    categoryId: string,
    kind: TransactionKind,
  ): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
      select: { kind: true },
    });
    if (!category) {
      throw new BadRequestException(
        'categoryId does not reference one of your categories',
      );
    }
    if ((category.kind as string) !== (kind as string)) {
      throw new BadRequestException(
        `categoryId must reference a ${kind} category`,
      );
    }
  }
}
