import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

// Edit a transaction (income/expense or transfer). `kind` is intentionally
// omitted — the global ValidationPipe (forbidNonWhitelisted) rejects any field
// not listed here, so kind/userId/id cannot be changed; to change kind, delete
// and recreate. The resulting record is re-validated against its (unchanged)
// kind, so a transfer can't gain a category and income/expense can't gain a
// toAccountId.
export class UpdateTransactionDto {
  @ApiPropertyOptional({
    description: 'Positive amount as a string, up to 2 decimal places',
    example: '99.50',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount must be a positive number with up to 2 decimal places',
  })
  amount?: string;

  @ApiPropertyOptional({ description: 'Transaction date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Source account id — must be owned by you',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({
    description:
      'Category id (INCOME/EXPENSE only) — owned, matching kind. Not allowed on a transfer.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description:
      'Destination account id (TRANSFER only) — owned, different from accountId. Not allowed on income/expense.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  toAccountId?: string;

  @ApiPropertyOptional({
    description: 'Free-text note. Send null to clear it.',
    example: 'Updated note',
    maxLength: 280,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string | null;
}
