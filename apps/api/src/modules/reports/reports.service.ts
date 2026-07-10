import { Injectable } from '@nestjs/common';
import { Prisma, TransactionKind } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

const DEFAULT_MONTHS = 12;

export interface MonthlyTotals {
  month: string; // 'YYYY-MM'
  income: string;
  expense: string;
  net: string; // income − expense; may be negative, e.g. "-250.00"
}

export interface CategorySpend {
  categoryId: string;
  name: string;
  total: string;
}
export interface CategoryRollup extends CategorySpend {
  children: CategorySpend[];
}
export interface MonthlyCategorySpending {
  month: string;
  grandTotal: string;
  categories: CategoryRollup[];
}

export interface MonthlyAdherence {
  month: string;
  budgeted: string; // Σ of the user's CURRENT limits — constant across the series
  spent: string; // that month's expense in budgeted categories
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dense monthly income / expense / net for the trailing `months` calendar
   * months (UTC, ending with the current month — the same month convention the
   * dashboard's period selector uses). Transfers and opening balances are
   * excluded by the kind whitelist (only INCOME + EXPENSE), exactly like the
   * dashboard's income-vs-expense aggregate. Money stays Decimal → 2dp string;
   * `net` is computed with Decimal arithmetic and may be negative. Every month in
   * range is present, zero-filled where there is no activity (no chart gaps).
   *
   * `now` is injectable for deterministic tests; production always uses the
   * current time.
   */
  async monthlyIncomeExpense(
    userId: string,
    months: number = DEFAULT_MONTHS,
    now: Date = new Date(),
  ): Promise<MonthlyTotals[]> {
    const { gte, lte } = monthRange(now, months);
    const rows = await this.prisma.transaction.findMany({
      where: {
        userId,
        kind: { in: [TransactionKind.INCOME, TransactionKind.EXPENSE] },
        date: { gte, lte },
      },
      select: { amount: true, date: true, kind: true },
    });

    const income = zeroFilledMonths(now, months);
    const expense = zeroFilledMonths(now, months);
    for (const r of rows) {
      const key = monthKeyOf(r.date);
      if (!income.has(key)) continue; // defensive: outside the dense range
      if (r.kind === TransactionKind.INCOME) {
        income.set(key, income.get(key)!.plus(r.amount));
      } else {
        expense.set(key, expense.get(key)!.plus(r.amount));
      }
    }

    return monthKeys(now, months).map((month) => {
      const inc = income.get(month)!;
      const exp = expense.get(month)!;
      return {
        month,
        income: inc.toFixed(2),
        expense: exp.toFixed(2),
        net: inc.minus(exp).toFixed(2),
      };
    });
  }

  /**
   * Dense monthly expense grouped by EXPENSE category, with parent rollups
   * (parent total = own direct + children's direct), matching the dashboard's
   * spending-by-category. Only EXPENSE rows count (transfers / opening / income
   * excluded via the kind filter). Money as strings.
   */
  async monthlyExpenseByCategory(
    userId: string,
    months: number = DEFAULT_MONTHS,
    now: Date = new Date(),
  ): Promise<MonthlyCategorySpending[]> {
    const [categories, directByMonth] = await Promise.all([
      this.prisma.category.findMany({
        where: { userId, kind: 'EXPENSE' },
        select: { id: true, name: true, parentId: true },
      }),
      this.expenseByMonthAndCategory(userId, months, now),
    ]);

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
    const parents = categories.filter((c) => c.parentId === null);

    return monthKeys(now, months).map((month) =>
      rollupMonth(month, directByMonth.get(month)!, parents, childrenByParent),
    );
  }

  /**
   * Dense monthly budget adherence: `budgeted` vs `spent` per month.
   *
   * `budgeted` is the sum of the user's CURRENT per-category limits. Budgets
   * carry no per-month history, so the current limits apply uniformly across the
   * whole range — an intentional FLAT reference line, not a reconstruction of
   * what the limits were in past months.
   *
   * `spent` is that month's EXPENSE in budgeted categories. It reuses the very
   * same per-month per-category spend basis that backs monthly-expense-by-category
   * (and therefore the Track 4 dashboard chart), so the three can never disagree.
   * Each expense is counted at most once, attributed to the nearest budgeted
   * category — itself if it has a budget, else its parent if the parent has one
   * (a parent's budget covers its unbudgeted children, matching the rollup
   * semantics of spending-by-category). Expenses in categories with no budget
   * anywhere up the chain are excluded. TRANSFER/OPENING never count (EXPENSE-only
   * kind filter).
   */
  async monthlyBudgetAdherence(
    userId: string,
    months: number = DEFAULT_MONTHS,
    now: Date = new Date(),
  ): Promise<MonthlyAdherence[]> {
    const [budgets, categories, directByMonth] = await Promise.all([
      this.prisma.budget.findMany({
        where: { userId },
        select: { categoryId: true, amount: true },
      }),
      this.prisma.category.findMany({
        where: { userId, kind: 'EXPENSE' },
        select: { id: true, parentId: true },
      }),
      this.expenseByMonthAndCategory(userId, months, now),
    ]);

    // Constant across every month — see the JSDoc note above.
    let budgetedTotal = new Prisma.Decimal(0);
    for (const b of budgets) budgetedTotal = budgetedTotal.plus(b.amount);
    const budgeted = budgetedTotal.toFixed(2);

    const budgetedIds = new Set(budgets.map((b) => b.categoryId));
    const parentOf = new Map(categories.map((c) => [c.id, c.parentId]));

    /** True when this category's spend rolls up to some budget (self or parent). */
    const isCovered = (categoryId: string): boolean => {
      if (budgetedIds.has(categoryId)) return true;
      const parent = parentOf.get(categoryId) ?? null;
      return parent !== null && budgetedIds.has(parent);
    };

    return monthKeys(now, months).map((month) => {
      const direct = directByMonth.get(month)!;
      let spent = new Prisma.Decimal(0);
      for (const [categoryId, amount] of direct) {
        if (isCovered(categoryId)) spent = spent.plus(amount);
      }
      return { month, budgeted, spent: spent.toFixed(2) };
    });
  }

  /**
   * month → categoryId → DIRECT expense sum over the range. The SINGLE spend
   * aggregation shared by monthly-expense-by-category and monthly-budget-adherence,
   * so both endpoints (and the dashboard chart built on the same basis) always
   * agree. EXPENSE only — transfers, opening balances and income are excluded by
   * the kind filter, exactly as the dashboard's spending-by-category does.
   */
  private async expenseByMonthAndCategory(
    userId: string,
    months: number,
    now: Date,
  ): Promise<Map<string, Map<string, Prisma.Decimal>>> {
    const { gte, lte } = monthRange(now, months);
    const rows = await this.prisma.transaction.findMany({
      where: { userId, kind: TransactionKind.EXPENSE, date: { gte, lte } },
      select: { amount: true, date: true, categoryId: true },
    });

    const directByMonth = new Map<string, Map<string, Prisma.Decimal>>();
    for (const month of monthKeys(now, months)) {
      directByMonth.set(month, new Map());
    }
    for (const r of rows) {
      if (!r.categoryId) continue;
      const bucket = directByMonth.get(monthKeyOf(r.date));
      if (!bucket) continue;
      bucket.set(
        r.categoryId,
        (bucket.get(r.categoryId) ?? new Prisma.Decimal(0)).plus(r.amount),
      );
    }
    return directByMonth;
  }
}

// ── UTC month helpers (same convention as the frontend period selector) ────────

function monthKeyOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Dense 'YYYY-MM' keys for the trailing `months` months, oldest → current. */
function monthKeys(now: Date, months: number): string[] {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    keys.push(monthKeyOf(new Date(Date.UTC(y, m - i, 1))));
  }
  return keys;
}

function zeroFilledMonths(
  now: Date,
  months: number,
): Map<string, Prisma.Decimal> {
  const map = new Map<string, Prisma.Decimal>();
  for (const key of monthKeys(now, months)) map.set(key, new Prisma.Decimal(0));
  return map;
}

/** UTC bounds: start of the oldest month … end of the current month. */
function monthRange(now: Date, months: number): { gte: Date; lte: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return {
    gte: new Date(Date.UTC(y, m - months + 1, 1, 0, 0, 0, 0)),
    lte: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)),
  };
}

/** One month's expense rollup — mirrors DashboardService.spendingByCategory. */
function rollupMonth(
  month: string,
  direct: Map<string, Prisma.Decimal>,
  parents: Array<{ id: string; name: string; parentId: string | null }>,
  childrenByParent: Map<string, Array<{ id: string; name: string }>>,
): MonthlyCategorySpending {
  const zero = () => new Prisma.Decimal(0);
  let grand = new Prisma.Decimal(0);

  const rollups = parents.map((parent) => {
    const children = (childrenByParent.get(parent.id) ?? []).map((c) => ({
      categoryId: c.id,
      name: c.name,
      totalDec: direct.get(c.id) ?? zero(),
    }));
    let totalDec = direct.get(parent.id) ?? zero();
    for (const child of children) totalDec = totalDec.plus(child.totalDec);
    return { categoryId: parent.id, name: parent.name, totalDec, children };
  });
  for (const r of rollups) grand = grand.plus(r.totalDec);

  const byTotalThenName = <
    T extends { totalDec: Prisma.Decimal; name: string },
  >(
    a: T,
    b: T,
  ) => b.totalDec.comparedTo(a.totalDec) || a.name.localeCompare(b.name);
  rollups.sort(byTotalThenName);

  return {
    month,
    grandTotal: grand.toFixed(2),
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
