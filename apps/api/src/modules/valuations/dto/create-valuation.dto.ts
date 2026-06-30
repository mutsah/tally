import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateValuationDto {
  @ApiProperty({
    description:
      'Account to value — must be owned by you and be an INVESTMENT or MICROLOANS account',
    format: 'uuid',
  })
  @IsUUID()
  accountId: string;

  @ApiProperty({
    description:
      'Snapshot value as a string, zero or greater, up to 2 decimal places (0 is allowed).',
    example: '1500.00',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'value must be zero or greater with up to 2 decimal places',
  })
  value: string;

  @ApiProperty({
    description: 'Snapshot date (ISO 8601). One snapshot per account per date.',
    example: '2026-06-30T00:00:00.000Z',
  })
  @IsDateString()
  asOf: string;

  @ApiPropertyOptional({
    description: 'Optional free-text note',
    example: 'End-of-month brokerage statement',
    maxLength: 280,
  })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}
