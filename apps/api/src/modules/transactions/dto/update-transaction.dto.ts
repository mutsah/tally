import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

// Edit an income/expense transaction. `kind` and `toAccountId` are intentionally
// omitted; the global ValidationPipe (forbidNonWhitelisted) rejects any field not
// listed here, so kind/userId/id cannot be changed through this endpoint.
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
    description: 'Category id — must be owned by you and match the kind',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

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
