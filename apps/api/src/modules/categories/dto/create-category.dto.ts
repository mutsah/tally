import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryKind } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Display name (unique among siblings for this user)',
    example: 'Groceries',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Whether this categorises income or expense',
    enum: CategoryKind,
    example: CategoryKind.EXPENSE,
  })
  @IsEnum(CategoryKind)
  kind: CategoryKind;

  @ApiPropertyOptional({
    description:
      'Optional parent category id. The parent must be top-level (no grandparents), owned by you, and the same kind. Omit for a top-level category.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
