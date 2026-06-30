import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListValuationsQueryDto {
  @ApiPropertyOptional({ description: 'Filter to one account', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  accountId?: string;
}
