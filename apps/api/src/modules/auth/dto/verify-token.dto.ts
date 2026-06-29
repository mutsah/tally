import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class VerifyTokenDto {
  @ApiProperty({
    description: 'verification token',
    example: '121540000er776',
  })
  @IsNotEmpty({ message: 'Token is requied' })
  token: string;
}
