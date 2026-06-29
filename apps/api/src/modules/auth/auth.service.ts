import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { SendResetLinkDto } from './dto/send-reset-link.dto';
import { MailService } from '../mail/mail.service';
import { VerifyTokenDto } from './dto/verify-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { OAuthUser } from './interfaces/oauth-user.interface';

@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 12;
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
    private configService: ConfigService,
  ) {}

  async oauthLogin(oauthUser: OAuthUser): Promise<AuthResponseDto> {
    const { email, firstName, lastName } = oauthUser;

    if (!email) {
      throw new BadRequestException(
        'OAuth provider did not return an email address',
      );
    }

    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      const randomPassword = randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(
        randomPassword,
        this.SALT_ROUNDS,
      );

      user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
        },
      });
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  // register user
  async register(RegisterDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, firstName, lastName } = RegisterDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    try {
      const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

      const user = await this.prisma.user.create({
        data: { email, password: hashedPassword, firstName, lastName },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          password: false,
        },
      });

      const tokens = await this.generateTokens(user.id, user.email);

      await this.updateRefreshToken(user.id, tokens.refreshToken);

      return { ...tokens, user };
    } catch (error) {
      this.logger.error('Error during user registration', error);

      throw new InternalServerErrorException(
        'An error occurred while registering the user. Please try again later.',
      );
    }
  }

  // generate JWT access and refresh tokens
  private async generateTokens(
    userId: string,
    email: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = { sub: userId, email };
    const refreshId = randomBytes(16).toString('hex');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: '15m' }),
      this.jwtService.signAsync(
        { ...payload, refreshId },
        {
          expiresIn: '7d',
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  //   update refresh token in database
  private async updateRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hashedRefreshToken = await bcrypt.hash(
      refreshToken,
      this.SALT_ROUNDS,
    );
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedRefreshToken },
    });
  }

  //   refresh access token
  async refreshTokens(userId: string): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = await this.generateTokens(user.id, user.email);

    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user,
    };
  }

  //   login
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  //   logout
  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  // send reset password link
  async sendLink(
    sendResetLinkDto: SendResetLinkDto,
  ): Promise<{ success: boolean; message: string }> {
    const { email } = sendResetLinkDto;

    const user = await this.prisma.user.findFirst({ where: { email } });

    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    // Remove any existing reset link
    await this.prisma.resetPassword.deleteMany({ where: { email } });

    const resetToken = await this.generateResetReference();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min expiry

    try {
      // Save reset token to database first
      await this.prisma.resetPassword.create({
        data: { email, token: resetToken, expiresAt },
      });

      // Send email after confirming database save
      await this.mailService.sendResetPasswordLink(
        email,
        resetToken,
        user.firstName || 'User',
      );

      return { success: true, message: 'Reset link sent successfully' };
    } catch (error) {
      // If email sending fails, cleanup the database record
      await this.prisma.resetPassword
        .delete({ where: { email } })
        .catch(() => {});

      this.logger.error('Error sending reset password email', error);
      throw new InternalServerErrorException(
        'Failed to send reset link. Please try again later.',
      );
    }
  }

  // verify reset token
  async verifyToken(
    verifyTokenDto: VerifyTokenDto,
  ): Promise<{ success: boolean; maskedEmail: string }> {
    const { token } = verifyTokenDto;

    const tokenExist = await this.prisma.resetPassword.findFirst({
      where: { token },
    });

    if (!tokenExist) {
      throw new NotFoundException('Invalid token');
    }

    if (new Date() > new Date(tokenExist.expiresAt)) {
      throw new BadRequestException('Token expired');
    }

    const maskedEmail = this.maskEmail(tokenExist.email);

    return { success: true, maskedEmail };
  }

  // reset password
  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    const { token, password } = resetPasswordDto;

    const tokenExist = await this.prisma.resetPassword.findFirst({
      where: { token },
    });

    if (!tokenExist) {
      throw new NotFoundException('Invalid token');
    }

    if (new Date() > new Date(tokenExist.expiresAt)) {
      throw new BadRequestException('Token expired');
    }

    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

    try {
      await this.prisma.user.update({
        where: { email: tokenExist.email },
        data: { password: hashedPassword },
      });
      await this.prisma.resetPassword.deleteMany({ where: { token } });
      return { success: true, message: 'Password reset successfully' };
    } catch (error) {
      this.logger.error('Error resetting password', error);
      throw new InternalServerErrorException(
        'Failed to reset password. Please try again later.',
      );
    }
  }

  private async generateResetReference() {
    const generateRandomValue = () => randomBytes(8).toString('hex');

    let unique: boolean = false;
    let reference: string = '';

    while (!unique) {
      reference = generateRandomValue();

      try {
        const referenceExists = await this.prisma.resetPassword.findFirst({
          where: { token: reference },
        });

        if (!referenceExists) {
          unique = true;
        }
      } catch (error) {
        this.logger.error(
          'Error during generating reset password token',
          error,
        );

        throw new InternalServerErrorException(
          'An error occurred while generating reset password token. Please try again later.',
        );
      }
    }

    return reference;
  }

  private maskEmail(email: string) {
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 2) {
      return `${localPart[0]}***@${domain}`;
    }
    return `${localPart.substring(0, 2)}***@${domain}`;
  }
}
