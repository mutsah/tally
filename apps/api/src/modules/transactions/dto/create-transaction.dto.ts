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
    description: 'INCOME or EXPENSE. TRANSFER is not supported yet.',
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

  @ApiProperty({
    description: 'Category id — must be owned by you and match the kind',
    format: 'uuid',
  })
  @IsUUID()
  categoryId: string;

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
