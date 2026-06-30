import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

// Each bound is optional; an omitted bound is unbounded on that side, so
// omitting both sums all-time.
export class DateRangeQueryDto {
  @ApiPropertyOptional({ description: 'Start of range, inclusive (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End of range, inclusive (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
