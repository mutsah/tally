import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Budget, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  TenantDelegate,
  TenantScopedService,
} from 'src/common/services/tenant-scoped.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

@Injectable()
export class BudgetsService extends TenantScopedService<Budget> {
  protected readonly entityName = 'Budget';

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  protected get delegate(): TenantDelegate {
    return this.prisma.budget as unknown as TenantDelegate;
  }

  async create(userId: string, dto: CreateBudgetDto): Promise<Budget> {
    await this.assertBudgetableCategory(userId, dto.categoryId);

    // One budget per category (create + 409 on duplicate, like categories).
    const existing = await this.findOneForUser(userId, {
      categoryId: dto.categoryId,
    });
    if (existing) {
      throw new ConflictException(
        'A budget already exists for this category; update it instead',
      );
    }

    const amount = this.parseAmount(dto.amount);
    try {
      return await this.createForUser(userId, {
        categoryId: dto.categoryId,
        amount,
      });
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  /** The caller's budgets, oldest first. Amounts serialize as strings globally. */
  findAll(userId: string): Promise<Budget[]> {
    return this.listForUser(userId, { orderBy: { createdAt: 'asc' } });
  }

  findOne(userId: string, id: string): Promise<Budget> {
    return this.getForUser(userId, id);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateBudgetDto,
  ): Promise<Budget> {
    const amount = this.parseAmount(dto.amount);
    return this.updateForUser(userId, id, { amount });
  }

  remove(userId: string, id: string): Promise<Budget> {
    return this.deleteForUser(userId, id);
  }

  /**
   * The referenced category must exist, be the caller's, and be an EXPENSE
   * category — a spending limit on an income category is meaningless (and would
   * inject a stray row into the budget-adherence chart).
   */
  private async assertBudgetableCategory(
    userId: string,
    categoryId: string,
  ): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
      select: { kind: true },
    });
    if (!category) {
      throw new BadRequestException('Category not found');
    }
    if (category.kind !== 'EXPENSE') {
      throw new BadRequestException(
        'A budget can only be set on an expense category',
      );
    }
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
      throw new BadRequestException('amount must have at most 2 decimal places');
    }
    return amount;
  }

  // Backstop for the unique([userId, categoryId]) constraint (race with create).
  private handleWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('A budget already exists for this category');
    }
    throw error;
  }
}
