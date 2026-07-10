import { Injectable } from '@nestjs/common';
import { AccountType, Prisma, TransactionKind } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';

const DEFAULT_MONTHS = 12;

// ── Slice C tuning ────────────────────────────────────────────────────────────
/** How many COMPLETE calendar months form a trailing baseline (burn + leaks). */
const TRAILING_MONTHS = 3;
/** A category is a "leak" when its latest complete month exceeds its trailing
 *  average by more than this ratio (0.25 = +25%). */
const LEAK_GROWTH_THRESHOLD = 0.25;
/** Categories whose trailing average is below this are never flagged: a big
 *  percentage on a trivial baseline is noise, and a 0.00 baseline cannot divide. */
const LEAK_MIN_BASELINE = '20.00';

/** Snapshot-valued (illiquid) account types — excluded from the runway buffer.
 *  Mirrors AccountsService.isValued, which is private to that module. */
const VALUED_TYPES: ReadonlySet<AccountType> = new Set([
  AccountType.INVESTMENT,
  AccountType.MICROLOANS,
]);

export interface Runway {
  buffer: string; // liquid balance (non-valued, non-archived accounts)
  monthlyBurn: string; // avg NET outflow (expense − income) per complete month
  runwayMonths: string | null; // months of buffer at that burn; null when not burning
}

export interface SpendingLeak {
  categoryId: string;
  categoryName: string;
  currentSpend: string;
  trailingAverage: string;
  /** PERCENTAGE increase over the trailing average, 1dp: "25.0" = +25%.
   *  Only the serialized value is scaled — the threshold test and the sort both
   *  run on the raw ratio, so no precision is lost at the flagging boundary. */
  pctIncrease: string;
}

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
  ) {}

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
    const { income, expense } = await this.incomeExpenseByMonth(
      userId,
      months,
      now,
    );

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
   * Cash runway — a POINT-IN-TIME snapshot, not a monthly series, so (unlike the
   * Slice A/B endpoints) it takes no ReportsRangeQueryDto.
   *
   * `buffer` is the liquid balance: the summed balance of the caller's non-archived,
   * NON-VALUED accounts. INVESTMENT/MICROLOANS are excluded — their balance is a
   * manual snapshot of an illiquid holding, not cash you can spend. It REUSES
   * AccountsService.findAll (the same grouped-balance aggregation the dashboard's
   * net worth uses: two grouped aggregates + one valuations query, no per-account
   * queries), never a second balance path.
   *
   * `monthlyBurn` is the average NET outflow (expense − income) over the last
   * TRAILING_MONTHS COMPLETE calendar months. The in-progress current month is
   * excluded: a partial month would understate burn. Transfers and opening
   * balances never count (the income/expense kind whitelist).
   *
   * `runwayMonths` = buffer ÷ monthlyBurn, by exact Decimal division, in three
   * cases:
   *   - monthlyBurn <= 0 → `null`. Net-positive or break-even: the buffer is not
   *     being drawn down, so "months of runway" is meaningless. Never Infinity,
   *     never a divide by zero.
   *   - buffer <= 0 → `"0.0"`. Already overdrawn: there is no runway left. A raw
   *     division here would emit a NEGATIVE duration, which is nonsense.
   *   - otherwise → buffer ÷ monthlyBurn.
   * It is a DURATION, not currency, so it serializes to 1 decimal place.
   */
  async runway(userId: string, now: Date = new Date()): Promise<Runway> {
    // TRAILING_MONTHS complete months + the partial current month we will drop.
    const [accounts, { income, expense }] = await Promise.all([
      this.accountsService.findAll(userId),
      this.incomeExpenseByMonth(userId, TRAILING_MONTHS + 1, now),
    ]);

    let buffer = new Prisma.Decimal(0);
    for (const account of accounts) {
      if (account.archived || VALUED_TYPES.has(account.type)) continue;
      buffer = buffer.plus(new Prisma.Decimal(account.balance));
    }

    let totalOutflow = new Prisma.Decimal(0);
    for (const month of completeMonthKeys(now, TRAILING_MONTHS)) {
      // Net outflow for the month; a high-income month offsets its expense.
      totalOutflow = totalOutflow.plus(
        expense.get(month)!.minus(income.get(month)!),
      );
    }
    const monthlyBurn = totalOutflow.div(TRAILING_MONTHS);

    let runwayMonths: string | null;
    if (monthlyBurn.lte(0)) {
      runwayMonths = null; // not burning down the buffer
    } else if (buffer.lte(0)) {
      runwayMonths = '0.0'; // already overdrawn — no runway, never a negative one
    } else {
      runwayMonths = buffer.div(monthlyBurn).toFixed(1);
    }

    return {
      buffer: buffer.toFixed(2),
      monthlyBurn: monthlyBurn.toFixed(2),
      runwayMonths,
    };
  }

  /**
   * Spending leaks — a POINT-IN-TIME heuristic, not a monthly series, so (unlike
   * the Slice A/B endpoints) it takes no ReportsRangeQueryDto.
   *
   * For each expense category, its MOST RECENT COMPLETE month's spend is compared
   * with the average of the TRAILING_MONTHS complete months before that one. The
   * in-progress current month is excluded from both sides. Spend comes from the
   * single shared per-month per-category expense aggregation (so this can never
   * disagree with monthly-expense-by-category or the adherence report), and is each
   * category's DIRECT spend — a parent and its child are judged independently.
   *
   * A category is only considered when its trailing average is at least
   * LEAK_MIN_BASELINE: a large percentage on a trivial baseline is noise, and a
   * zero baseline cannot be divided. Consequently BRAND-NEW spend (no trailing
   * history) is never a "leak" here — that is what the spending-over-time report is
   * for. Flagged when the increase exceeds LEAK_GROWTH_THRESHOLD; biggest first.
   * This is a heuristic, not advice.
   */
  async spendingLeaks(
    userId: string,
    now: Date = new Date(),
  ): Promise<SpendingLeak[]> {
    // current (partial, dropped) + latest complete + TRAILING_MONTHS before it.
    const months = TRAILING_MONTHS + 2;
    const [categories, directByMonth] = await Promise.all([
      this.prisma.category.findMany({
        where: { userId, kind: 'EXPENSE' },
        select: { id: true, name: true },
      }),
      this.expenseByMonthAndCategory(userId, months, now),
    ]);

    const complete = completeMonthKeys(now, TRAILING_MONTHS + 1);
    const currentMonth = complete[complete.length - 1]; // latest COMPLETE month
    const baselineMonths = complete.slice(0, TRAILING_MONTHS);

    const minBaseline = new Prisma.Decimal(LEAK_MIN_BASELINE);
    const zero = new Prisma.Decimal(0);
    const spendIn = (month: string, categoryId: string) =>
      directByMonth.get(month)?.get(categoryId) ?? zero;

    const leaks: Array<{ leak: SpendingLeak; pct: Prisma.Decimal }> = [];
    for (const category of categories) {
      const currentSpend = spendIn(currentMonth, category.id);

      let trailingTotal = new Prisma.Decimal(0);
      for (const month of baselineMonths) {
        trailingTotal = trailingTotal.plus(spendIn(month, category.id));
      }
      const trailingAverage = trailingTotal.div(TRAILING_MONTHS);

      // Guards the divide AND suppresses noise on trivial baselines.
      if (trailingAverage.lt(minBaseline)) continue;

      // The RAW ratio drives the threshold test and the sort; only the emitted
      // value is scaled to a percentage (0.2501 → "25.0", not a rounded "0.3").
      const pct = currentSpend.minus(trailingAverage).div(trailingAverage);
      if (!pct.gt(LEAK_GROWTH_THRESHOLD)) continue;

      leaks.push({
        leak: {
          categoryId: category.id,
          categoryName: category.name,
          currentSpend: currentSpend.toFixed(2),
          trailingAverage: trailingAverage.toFixed(2),
          pctIncrease: pct.times(100).toFixed(1),
        },
        pct,
      });
    }

    // Sort on the exact Decimal, not the rounded string.
    leaks.sort((a, b) => b.pct.comparedTo(a.pct));
    return leaks.map((entry) => entry.leak);
  }

  /**
   * month → summed INCOME and EXPENSE Decimals, dense/zero-filled. The SINGLE
   * income/expense aggregation, shared by monthly-income-expense and the runway
   * burn, so they can never disagree. Transfers and opening balances are excluded
   * by the kind whitelist.
   */
  private async incomeExpenseByMonth(
    userId: string,
    months: number,
    now: Date,
  ): Promise<{
    income: Map<string, Prisma.Decimal>;
    expense: Map<string, Prisma.Decimal>;
  }> {
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
    return { income, expense };
  }

  /**
   * month → categoryId → DIRECT expense sum over the range. The SINGLE spend
   * aggregation shared by monthly-expense-by-category, monthly-budget-adherence and
   * spending-leaks, so they always agree. EXPENSE only — transfers, opening balances
   * and income are excluded by the kind filter, exactly as the dashboard's
   * spending-by-category does.
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

/**
 * The last `count` COMPLETE calendar months, oldest → newest. The in-progress
 * current month is deliberately excluded: it is partial, so including it would
 * understate burn and distort a trailing average.
 */
function completeMonthKeys(now: Date, count: number): string[] {
  return monthKeys(now, count + 1).slice(0, count);
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
