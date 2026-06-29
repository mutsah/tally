import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiExcludeEndpoint,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { SendResetLinkDto } from './dto/send-reset-link.dto';
import { VerifyTokenDto } from './dto/verify-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { Request, Response } from 'express';
import { OAuthUser } from './interfaces/oauth-user.interface';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiExcludeEndpoint()
  async googleAuth(): Promise<void> {
    return;
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiExcludeEndpoint()
  async googleCallback(
    @Req() req: Request & { user: OAuthUser },
    @Res() res: Response,
  ) {
    const result = await this.authService.oauthLogin(req.user);
    const frontendBase = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const frontendUrl = `${frontendBase}/oauth-success`;
    const params = new URLSearchParams({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName || '',
      lastName: result.user.lastName || '',
      role: result.user.role,
    });
    res.redirect(`${frontendUrl}?${params.toString()}`);
  }

  @Get('github')
  @UseGuards(AuthGuard('github'))
  @ApiExcludeEndpoint()
  async githubAuth(): Promise<void> {
    return;
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  @ApiExcludeEndpoint()
  async githubCallback(
    @Req() req: Request & { user: OAuthUser },
    @Res() res: Response,
  ) {
    const result = await this.authService.oauthLogin(req.user);
    const frontendBase = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const frontendUrl = `${frontendBase}/oauth-success`;
    const params = new URLSearchParams({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName || '',
      lastName: result.user.lastName || '',
      role: result.user.role,
    });
    res.redirect(`${frontendUrl}?${params.toString()}`);
  }

  // register api
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Create a new user account',
  })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation failed or user already exists',
  })
  @ApiResponse({
    status: 500,
    description:
      'Internal Server Error - An error occurred during registration',
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests - Rate limit exceeded',
  })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return await this.authService.register(registerDto);
  }

  // refresh access token
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RefreshTokenGuard)
  @ApiBearerAuth('Refresh-JWT')
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Generate a new access token using a valid refresh token',
  })
  @ApiResponse({
    status: 200,
    description: 'Access token successfully refreshed',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired refresh token',
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests - Rate limit exceeded',
  })
  async refresh(@GetUser('id') userId: string): Promise<AuthResponseDto> {
    return await this.authService.refreshTokens(userId);
  }

  // login
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login user',
    description: 'Authenticate user and return access and refresh tokens',
  })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid credentials',
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests - Rate limit exceeded',
  })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return await this.authService.login(loginDto);
  }

  // logout user and invalidate refresh token
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Logout user',
    description: 'Logout the user and invalidate the refresh token',
  })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged out',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired JWT token',
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests - Rate limit exceeded',
  })
  async logout(@GetUser('id') userId: string): Promise<{ message: string }> {
    await this.authService.logout(userId);
    return { message: 'Successfully logged out' };
  }

  // send reset password link
  @Post('send-reset-link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send reset password',
    description: 'send reset password email with token',
  })
  @ApiResponse({
    status: 200,
    description: 'Reset link send successfully',
    type: SendResetLinkDto,
  })
  @ApiBadRequestResponse({
    description: 'User not found',
  })
  async sendLink(@Body() sendResetLinkDto: SendResetLinkDto) {
    return await this.authService.sendLink(sendResetLinkDto);
  }

  // verify password reset token
  @Post('verify-reset-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify Reset Token',
    description: 'Verify password reset token',
  })
  @ApiResponse({
    status: 200,
    description: 'Token verified',
  })
  @ApiBadRequestResponse({
    description: 'Token expired ',
  })
  @ApiNotFoundResponse({
    description: 'Token not found',
  })
  async verifyToken(@Body() verifyTokenDto: VerifyTokenDto) {
    return await this.authService.verifyToken(verifyTokenDto);
  }

  // reset password using token
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset Password',
    description: 'Reset user password using a valid token',
  })
  @ApiResponse({
    status: 200,
    description: 'Password successfully reset',
  })
  @ApiBadRequestResponse({
    description: 'Token expired ',
  })
  @ApiNotFoundResponse({
    description: 'Token not found',
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return await this.authService.resetPassword(resetPasswordDto);
  }
}
