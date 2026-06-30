import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { AccountType, AccountValuation, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  TenantDelegate,
  TenantScopedService,
} from 'src/common/services/tenant-scoped.service';
import { CreateValuationDto } from './dto/create-valuation.dto';
import { UpdateValuationDto } from './dto/update-valuation.dto';
import { ListValuationsQueryDto } from './dto/list-valuations-query.dto';

@Injectable()
export class ValuationsService extends TenantScopedService<AccountValuation> {
  protected readonly entityName = 'Valuation';

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  protected get delegate(): TenantDelegate {
    return this.prisma.accountValuation as unknown as TenantDelegate;
  }

  async create(
    userId: string,
    dto: CreateValuationDto,
  ): Promise<AccountValuation> {
    const value = this.parseValue(dto.value);
    await this.assertValuedAccountOwned(userId, dto.accountId);

    try {
      return await this.createForUser(userId, {
        accountId: dto.accountId,
        value,
        asOf: new Date(dto.asOf),
        note: dto.note ?? null,
      });
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  findAll(
    userId: string,
    query: ListValuationsQueryDto,
  ): Promise<AccountValuation[]> {
    const where = query.accountId ? { accountId: query.accountId } : {};
    return this.listForUser(userId, { where, orderBy: { asOf: 'desc' } });
  }

  findOne(userId: string, id: string): Promise<AccountValuation> {
    return this.getForUser(userId, id);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateValuationDto,
  ): Promise<AccountValuation> {
    await this.getForUser(userId, id);
    const data: Record<string, unknown> = {};

    if (dto.value !== undefined) {
      data.value = this.parseValue(dto.value);
    }
    if (dto.asOf !== undefined) {
      data.asOf = new Date(dto.asOf);
    }
    if (dto.note !== undefined) {
      data.note = dto.note; // null clears
    }

    if (Object.keys(data).length === 0) {
      return this.getForUser(userId, id);
    }

    try {
      return await this.updateForUser(userId, id, data);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  remove(userId: string, id: string): Promise<AccountValuation> {
    return this.deleteForUser(userId, id);
  }

  /** Parse + validate a value string into a Decimal that is >= 0 and ≤2dp (no floats). */
  private parseValue(value: string): Prisma.Decimal {
    let parsed: Prisma.Decimal;
    try {
      parsed = new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException('value is not a valid number');
    }
    if (!parsed.isFinite() || parsed.lt(0)) {
      throw new BadRequestException('value must be zero or greater');
    }
    if (parsed.decimalPlaces() > 2) {
      throw new BadRequestException('value must have at most 2 decimal places');
    }
    return parsed;
  }

  /** The account must be the caller's AND a valued (INVESTMENT/MICROLOANS) account. */
  private async assertValuedAccountOwned(
    userId: string,
    accountId: string,
  ): Promise<void> {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
      select: { type: true },
    });
    if (!account) {
      throw new BadRequestException(
        'accountId does not reference one of your accounts',
      );
    }
    if (
      account.type !== AccountType.INVESTMENT &&
      account.type !== AccountType.MICROLOANS
    ) {
      throw new BadRequestException(
        'valuations apply only to investment and microloan accounts',
      );
    }
  }

  // Map the unique([accountId, asOf]) violation to a clean 409.
  private handleWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A valuation already exists for this account on that date',
      );
    }
    throw error;
  }
}
