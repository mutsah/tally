import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionKind } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({
    description:
      'INCOME, EXPENSE, or TRANSFER. INCOME/EXPENSE require categoryId and forbid toAccountId; TRANSFER requires toAccountId and forbids categoryId.',
    enum: TransactionKind,
    example: TransactionKind.EXPENSE,
  })
  @IsEnum(TransactionKind)
  kind: TransactionKind;

  @ApiProperty({
    description:
      'Positive amount as a string, up to 2 decimal places. Direction comes from kind, never from sign.',
    example: '1250.00',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount must be a positive number with up to 2 decimal places',
  })
  amount: string;

  @ApiProperty({
    description: 'Transaction date (ISO 8601)',
    example: '2026-06-29T00:00:00.000Z',
  })
  @IsDateString()
  date: string;

  @ApiProperty({
    description: 'Source account id — must be owned by you',
    format: 'uuid',
  })
  @IsUUID()
  accountId: string;

  @ApiPropertyOptional({
    description:
      'Category id. Required for INCOME/EXPENSE (owned, matching kind); must be omitted for TRANSFER.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description:
      'Destination account id. Required for TRANSFER (owned, different from accountId); must be omitted for INCOME/EXPENSE.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  toAccountId?: string;

  @ApiPropertyOptional({
    description: 'Optional free-text note',
    example: 'Groceries at the corner shop',
    maxLength: 280,
  })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}
