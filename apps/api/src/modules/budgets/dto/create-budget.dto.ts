import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Matches } from 'class-validator';

export class CreateBudgetDto {
  @ApiProperty({
    description: 'The category this monthly limit applies to — must be owned by you',
    format: 'uuid',
  })
  @IsUUID()
  categoryId: string;

  @ApiProperty({
    description:
      'Monthly limit as a string, greater than 0, up to 2 decimal places.',
    example: '500.00',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount must be a positive number with up to 2 decimal places',
  })
  amount: string;
}
