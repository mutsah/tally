// Data Transfer Object for updating the authenticated user's display name.

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'New first name',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'First name cannot be empty' })
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({
    description: 'New last name',
    example: 'Doe',
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Last name cannot be empty' })
  @MaxLength(100)
  lastName?: string;
}
