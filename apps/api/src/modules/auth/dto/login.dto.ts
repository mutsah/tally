import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'The email address of the user',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is requied' })
  email: string;

  @ApiProperty({
    description: 'The password of the user',
    example: 'P@ssw0rd',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is requied' })
  password: string;
}
