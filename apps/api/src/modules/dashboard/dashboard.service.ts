import { Injectable } from '@nestjs/common';
import { Prisma, TransactionKind } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';

const DEFAULT_RECENT_LIMIT = 10;
const MAX_RECENT_LIMIT = 50;

export interface NetWorth {
  total: string;
  accounts: Array<{
    accountId: string;
    name: string;
    type: string;
    balance: string;
  }>;
}

export interface CategorySpend {
  categoryId: string;
  name: string;
  total: string;
}
export interface CategoryRollup extends CategorySpend {
  children: CategorySpend[];
}
export interface SpendingByCategory {
  grandTotal: string;
  categories: CategoryRollup[];
}

export interface IncomeVsExpense {
  income: string;
  expense: string;
  net: string;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
  ) {}

  /**
   * Net worth REUSES the accounts balance computation (derived flow + latest
   * valuation snapshot) — never a transaction re-sum, which would double-count
   * valued accounts. Archived accounts are excluded from both total and
   * breakdown. Query count: same as GET /accounts (≤4: accounts + derived
   * groupBy ×2 + valuations distinct ×1).
   */
  async netWorth(userId: string): Promise<NetWorth> {
    const accounts = await this.accountsService.findAll(userId);
    let total = new Prisma.Decimal(0);
    const breakdown: NetWorth['accounts'] = [];
    for (const account of accounts) {
      if (account.archived) continue;
      total = total.plus(new Prisma.Decimal(account.balance));
      breakdown.push({
        accountId: account.id,
        name: account.name,
        type: account.type,
        balance: account.balance,
      });
    }
    return { total: total.toFixed(2), accounts: breakdown };
  }

  /**
   * Spending grouped by EXPENSE category in range (transfers + income excluded
   * via the kind filter). One level of nesting: a parent's total = its own
   * direct spend + the sum of its children's spend; each child counts once.
   * Query count: 2 (categories + grouped expense sums).
   */
  async spendingByCategory(
    userId: string,
    from?: string,
    to?: string,
  ): Promise<SpendingByCategory> {
    const categories = await this.prisma.category.findMany({
      where: { userId, kind: 'EXPENSE' },
      select: { id: true, name: true, parentId: true },
    });

    const where: Prisma.TransactionWhereInput = {
      userId,
      kind: TransactionKind.EXPENSE,
    };
    const range = this.dateRange(from, to);
    if (range) where.date = range;

    const grouped = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where,
      _sum: { amount: true },
      orderBy: { categoryId: 'asc' },
    });

    const direct = new Map<string, Prisma.Decimal>();
    let grandTotal = new Prisma.Decimal(0);
    for (const g of grouped) {
      if (!g.categoryId) continue;
      const amount = g._sum.amount ?? new Prisma.Decimal(0);
      direct.set(g.categoryId, amount);
      grandTotal = grandTotal.plus(amount);
    }

    const childrenByParent = new Map<
      string,
      Array<{ id: string; name: string }>
    >();
    for (const c of categories) {
      if (c.parentId) {
        const list = childrenByParent.get(c.parentId) ?? [];
        list.push({ id: c.id, name: c.name });
        childrenByParent.set(c.parentId, list);
      }
    }

    const zero = () => new Prisma.Decimal(0);
    const rollups = categories
      .filter((c) => c.parentId === null)
      .map((parent) => {
        const children = (childrenByParent.get(parent.id) ?? []).map((c) => ({
          categoryId: c.id,
          name: c.name,
          totalDec: direct.get(c.id) ?? zero(),
        }));
        let totalDec = direct.get(parent.id) ?? zero();
        for (const child of children) {
          totalDec = totalDec.plus(child.totalDec);
        }
        return { categoryId: parent.id, name: parent.name, totalDec, children };
      });

    const byTotalThenName = <
      T extends { totalDec: Prisma.Decimal; name: string },
    >(
      a: T,
      b: T,
    ) => b.totalDec.comparedTo(a.totalDec) || a.name.localeCompare(b.name);

    rollups.sort(byTotalThenName);

    return {
      grandTotal: grandTotal.toFixed(2),
      categories: rollups.map((r) => ({
        categoryId: r.categoryId,
        name: r.name,
        total: r.totalDec.toFixed(2),
        children: r.children.sort(byTotalThenName).map((c) => ({
          categoryId: c.categoryId,
          name: c.name,
          total: c.totalDec.toFixed(2),
        })),
      })),
    };
  }

  /**
   * Total INCOME and EXPENSE over range, transfers excluded from both.
   * net = income − expense (may be negative). Query count: 1.
   */
  async incomeVsExpense(
    userId: string,
    from?: string,
    to?: string,
  ): Promise<IncomeVsExpense> {
    const where: Prisma.TransactionWhereInput = {
      userId,
      kind: { in: [TransactionKind.INCOME, TransactionKind.EXPENSE] },
    };
    const range = this.dateRange(from, to);
    if (range) where.date = range;

    const grouped = await this.prisma.transaction.groupBy({
      by: ['kind'],
      where,
      _sum: { amount: true },
      orderBy: { kind: 'asc' },
    });

    let income = new Prisma.Decimal(0);
    let expense = new Prisma.Decimal(0);
    for (const g of grouped) {
      const amount = g._sum.amount ?? new Prisma.Decimal(0);
      if (g.kind === TransactionKind.INCOME) income = amount;
      else if (g.kind === TransactionKind.EXPENSE) expense = amount;
    }

    return {
      income: income.toFixed(2),
      expense: expense.toFixed(2),
      net: income.minus(expense).toFixed(2),
    };
  }

  /**
   * The user's most recent transactions (date desc), INCLUDING transfers (they
   * are real activity, even though excluded from the sums above). Query count: 1.
   */
  async recentActivity(userId: string, limit?: number) {
    const take = Math.min(limit ?? DEFAULT_RECENT_LIMIT, MAX_RECENT_LIMIT);
    const account = { select: { id: true, name: true, type: true } };
    const txns = await this.prisma.transaction.findMany({
      where: { userId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take,
      include: {
        account,
        toAccount: account,
        category: { select: { id: true, name: true, kind: true } },
      },
    });

    return txns.map((t) => ({
      id: t.id,
      kind: t.kind,
      amount: t.amount.toFixed(2),
      date: t.date,
      note: t.note,
      account: t.account,
      toAccount: t.toAccount,
      category: t.category,
    }));
  }

  private dateRange(
    from?: string,
    to?: string,
  ): { gte?: Date; lte?: Date } | undefined {
    if (!from && !to) return undefined;
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    return range;
  }
}
