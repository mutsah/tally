import { ConflictException, Injectable } from '@nestjs/common';
import { Account, AccountType, Prisma, TransactionKind } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  TenantDelegate,
  TenantScopedService,
} from 'src/common/services/tenant-scoped.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

/** An account plus its computed (never stored) balance, serialized as a string. */
export type AccountWithBalance = Account & { balance: string };

@Injectable()
export class AccountsService extends TenantScopedService<Account> {
  protected readonly entityName = 'Account';

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  protected get delegate(): TenantDelegate {
    return this.prisma.account as unknown as TenantDelegate;
  }

  async create(userId: string, dto: CreateAccountDto): Promise<Account> {
    try {
      return await this.createForUser(userId, {
        name: dto.name,
        type: dto.type,
      });
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async findAll(userId: string): Promise<AccountWithBalance[]> {
    const accounts = await this.listForUser(userId, {
      orderBy: { createdAt: 'desc' },
    });

    // For ALL accounts at once: derived balances via 2 grouped aggregates, and
    // the latest valuation per valued account via 1 distinct query — no N+1.
    const hasDerived = accounts.some((a) => !this.isValued(a.type));
    const valuedIds = accounts
      .filter((a) => this.isValued(a.type))
      .map((a) => a.id);
    const [derived, valuations] = await Promise.all([
      hasDerived
        ? this.computeDerivedBalances(userId)
        : Promise.resolve(new Map<string, Prisma.Decimal>()),
      this.latestValuations(userId, valuedIds),
    ]);

    return accounts.map((a) => this.withBalance(a, derived, valuations));
  }

  async findOne(userId: string, id: string): Promise<AccountWithBalance> {
    const account = await this.getForUser(userId, id);
    const empty = new Map<string, Prisma.Decimal>();
    // Only query what this account's type needs.
    if (this.isValued(account.type)) {
      const valuations = await this.latestValuations(userId, [id]);
      return this.withBalance(account, empty, valuations);
    }
    const derived = await this.computeDerivedBalances(userId);
    return this.withBalance(account, derived, empty);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateAccountDto,
  ): Promise<Account> {
    try {
      return await this.updateForUser(userId, id, { ...dto });
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  // TODO(transactions, Phase 4): block deletion when the account has
  // transactions (or is referenced as a transfer's toAccountId). Until that
  // guard lands, deletion proceeds.
  remove(userId: string, id: string): Promise<Account> {
    return this.deleteForUser(userId, id);
  }

  /**
   * Net derived balance per account from the caller's own transactions, using
   * two grouped aggregates (decimal-safe, no JS number math):
   *   + Σ INCOME(amount)           where accountId = acc
   *   − Σ EXPENSE(amount)          where accountId = acc
   *   − Σ TRANSFER(amount)         where accountId = acc      (transfers OUT)
   *   + Σ TRANSFER(amount)         where toAccountId = acc    (transfers IN)
   * A transfer is read once on each side. Valued accounts are not included here
   * (they ignore transaction flow — see withBalance).
   */
  private async computeDerivedBalances(
    userId: string,
  ): Promise<Map<string, Prisma.Decimal>> {
    const bySource = await this.prisma.transaction.groupBy({
      by: ['accountId', 'kind'],
      where: { userId },
      _sum: { amount: true },
      orderBy: { accountId: 'asc' },
    });

    const transfersIn = await this.prisma.transaction.groupBy({
      by: ['toAccountId'],
      where: { userId, kind: TransactionKind.TRANSFER },
      _sum: { amount: true },
      orderBy: { toAccountId: 'asc' },
    });

    const balances = new Map<string, Prisma.Decimal>();
    const apply = (
      accountId: string | null,
      amount: Prisma.Decimal | null,
      sign: 1 | -1,
    ) => {
      if (!accountId || !amount) return;
      const current = balances.get(accountId) ?? new Prisma.Decimal(0);
      balances.set(
        accountId,
        sign === 1 ? current.plus(amount) : current.minus(amount),
      );
    };

    for (const group of bySource) {
      if (group.kind === TransactionKind.INCOME) {
        apply(group.accountId, group._sum.amount, 1);
      } else if (group.kind === TransactionKind.EXPENSE) {
        apply(group.accountId, group._sum.amount, -1);
      } else if (group.kind === TransactionKind.TRANSFER) {
        apply(group.accountId, group._sum.amount, -1); // out of source
      }
    }
    for (const group of transfersIn) {
      apply(group.toAccountId, group._sum.amount, 1); // into destination
    }

    return balances;
  }

  /**
   * Latest valuation value per valued account, in ONE query: distinct on
   * accountId after ordering [accountId asc, asOf desc] keeps the greatest-asOf
   * row per account. Scoped to the caller's userId and the given account ids.
   */
  private async latestValuations(
    userId: string,
    accountIds: string[],
  ): Promise<Map<string, Prisma.Decimal>> {
    if (accountIds.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.accountValuation.findMany({
      where: { userId, accountId: { in: accountIds } },
      distinct: ['accountId'],
      orderBy: [{ accountId: 'asc' }, { asOf: 'desc' }],
      select: { accountId: true, value: true },
    });
    return new Map(rows.map((r) => [r.accountId, r.value]));
  }

  private withBalance(
    account: Account,
    derived: Map<string, Prisma.Decimal>,
    valuations: Map<string, Prisma.Decimal>,
  ): AccountWithBalance {
    return {
      ...account,
      balance: this.balanceFor(account, derived, valuations),
    };
  }

  private balanceFor(
    account: Account,
    derived: Map<string, Prisma.Decimal>,
    valuations: Map<string, Prisma.Decimal>,
  ): string {
    if (this.isValued(account.type)) {
      // Valued accounts IGNORE transaction flow: balance = latest valuation
      // snapshot, or "0.00" only when no snapshot exists yet.
      return (valuations.get(account.id) ?? new Prisma.Decimal(0)).toFixed(2);
    }
    return (derived.get(account.id) ?? new Prisma.Decimal(0)).toFixed(2);
  }

  private isValued(type: AccountType): boolean {
    return type === AccountType.INVESTMENT || type === AccountType.MICROLOANS;
  }

  // Map the unique([userId, name]) violation to a clean 409 instead of a 500.
  private handleWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('An account with this name already exists');
    }
    throw error;
  }
}
