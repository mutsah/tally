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
    const { gte, lte } = monthRange(now, months);
    const [categories, rows] = await Promise.all([
      this.prisma.category.findMany({
        where: { userId, kind: 'EXPENSE' },
        select: { id: true, name: true, parentId: true },
      }),
      this.prisma.transaction.findMany({
        where: { userId, kind: TransactionKind.EXPENSE, date: { gte, lte } },
        select: { amount: true, date: true, categoryId: true },
      }),
    ]);

    // month → categoryId → direct Decimal sum
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

function zeroFilledMonths(now: Date, months: number): Map<string, Prisma.Decimal> {
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

  const byTotalThenName = <T extends { totalDec: Prisma.Decimal; name: string }>(
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
