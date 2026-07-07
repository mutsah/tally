import { ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionKind } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

// Same filters as GET /transactions, minus pagination — the export returns the
// full filtered set.
export class ExportTransactionsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by source account',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({ description: 'Filter by category', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Filter by kind (INCOME, EXPENSE, TRANSFER, OPENING)',
    enum: TransactionKind,
  })
  @IsOptional()
  @IsEnum(TransactionKind)
  kind?: TransactionKind;

  @ApiPropertyOptional({
    description: 'Start of date range, inclusive (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'End of date range, inclusive (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
