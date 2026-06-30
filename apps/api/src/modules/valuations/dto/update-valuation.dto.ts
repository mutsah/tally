import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Edit a valuation. `accountId` is intentionally omitted — the global
// ValidationPipe (forbidNonWhitelisted) rejects any field not listed here, so a
// valuation can't be moved to another account; delete and recreate instead.
export class UpdateValuationDto {
  @ApiPropertyOptional({
    description:
      'Snapshot value as a string, zero or greater, up to 2 decimals',
    example: '1625.50',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'value must be zero or greater with up to 2 decimal places',
  })
  value?: string;

  @ApiPropertyOptional({ description: 'Snapshot date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @ApiPropertyOptional({
    description: 'Free-text note. Send null to clear it.',
    maxLength: 280,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string | null;
}
