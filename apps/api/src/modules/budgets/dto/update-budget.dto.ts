import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class UpdateBudgetDto {
  @ApiProperty({
    description:
      'New monthly limit as a string, greater than 0, up to 2 decimal places.',
    example: '650.00',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount must be a positive number with up to 2 decimal places',
  })
  amount: string;
}
