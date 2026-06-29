import { ConflictException, Injectable } from '@nestjs/common';
import { Account, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  TenantDelegate,
  TenantScopedService,
} from 'src/common/services/tenant-scoped.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

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

  findAll(userId: string): Promise<Account[]> {
    return this.listForUser(userId, { orderBy: { createdAt: 'desc' } });
  }

  findOne(userId: string, id: string): Promise<Account> {
    return this.getForUser(userId, id);
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
  // transactions (or is referenced as a transfer's toAccountId). Until the
  // Transaction model exists there is nothing to guard, so deletion proceeds.
  remove(userId: string, id: string): Promise<Account> {
    return this.deleteForUser(userId, id);
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
