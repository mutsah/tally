import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

// Rename and/or re-parent only. `kind` is intentionally omitted (a category's
// kind is fixed), and the global ValidationPipe (forbidNonWhitelisted) rejects
// any other field — so `userId`/`id`/`kind` cannot be changed here.
//
// parentId semantics in the service:
//   - omitted  -> parent unchanged
//   - null     -> promote to top-level
//   - a uuid   -> re-parent under that (validated) category
export class UpdateCategoryDto {
  @ApiPropertyOptional({
    description: 'New display name (unique among siblings)',
    example: 'Eating out',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description:
      'New parent id (must be top-level, owned by you, same kind). Send null to make this a top-level category. Omit to leave unchanged.',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}
