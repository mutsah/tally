import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// Only rename/archive are allowed here. `type` is intentionally omitted, and the
// global ValidationPipe (forbidNonWhitelisted) rejects any other field — so a
// client cannot change `type`, `userId`, or `id` through this endpoint.
export class UpdateAccountDto {
  @ApiPropertyOptional({
    description: 'New display name (unique per user)',
    example: 'Renamed Account',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Archive (true) or unarchive (false) the account',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
