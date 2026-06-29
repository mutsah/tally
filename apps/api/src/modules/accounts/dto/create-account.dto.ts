import { ApiProperty } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateAccountDto {
  @ApiProperty({
    description: 'Display name for the account (unique per user)',
    example: 'Everyday Checking',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Kind of account',
    enum: AccountType,
    example: AccountType.BANK,
  })
  @IsEnum(AccountType)
  type: AccountType;
}
