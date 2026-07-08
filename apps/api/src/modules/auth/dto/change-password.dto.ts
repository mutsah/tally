// Data Transfer Object for an authenticated user changing their own password.

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'The user’s current password (re-verified before the change)',
    example: 'P@ssw0rd',
  })
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword: string;

  @ApiProperty({
    description: 'The new password',
    example: 'N3wP@ssword',
  })
  // Same policy as registration (register.dto.ts): min 6, at least one letter
  // and one number — keeps the account-password rule consistent.
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{6,}$/, {
    message: 'Password must contain at least one letter and one number',
  })
  newPassword: string;
}
