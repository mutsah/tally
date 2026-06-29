import {
  BadRequestException,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import { Prisma, Transaction, TransactionKind } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  TenantDelegate,
  TenantScopedService,
} from 'src/common/services/tenant-scoped.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';

export interface PaginatedTransactions {
  data: Transaction[];
  page: number;
  pageSize: number;
  total: number;
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
    if (dto.kind === TransactionKind.TRANSFER) {
      throw new NotImplementedException(
        'Transfers are not supported yet — coming in the next step',
      );
    }

    const amount = this.parseAmount(dto.amount);
    await this.assertAccountOwned(userId, dto.accountId);
    await this.assertCategoryMatchesKind(userId, dto.categoryId, dto.kind);

    return this.createForUser(userId, {
      kind: dto.kind,
      amount,
      date: new Date(dto.date),
      note: dto.note ?? null,
      accountId: dto.accountId,
      toAccountId: null, // income/expense never have a destination account
      categoryId: dto.categoryId,
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
    if (dto.accountId !== undefined) {
      await this.assertAccountOwned(userId, dto.accountId);
      data.accountId = dto.accountId;
    }
    if (dto.categoryId !== undefined) {
      await this.assertCategoryMatchesKind(
        userId,
        dto.categoryId,
        current.kind,
      );
      data.categoryId = dto.categoryId;
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
      where.accountId = query.accountId;
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
  ): Promise<void> {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    });
    if (!account) {
      throw new BadRequestException(
        'accountId does not reference one of your accounts',
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
