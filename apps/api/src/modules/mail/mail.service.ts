import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendResetPasswordLink(
    to: string,
    token: string,
    firstName: string,
  ): Promise<void> {
    const from = this.configService.get<string>('SMTP_FROM');

    const url = `${this.configService.get<string>('APP_URL')}reset-password?token=${token}`;

    await this.transporter.sendMail({
      from: `"Mutsah" <${from}>`,
      to,
      subject: 'Reset Password Link',
      text: `Hi ${firstName},\n\nClick the link below to reset your password:\n\n${url}\n\nIt expires in 15 minutes. Do not share it.\n\nIf you didn't request this, ignore this email.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:8px">
          <h2 style="color:#4A90E2;margin-bottom:8px">Mutsah</h2>
          <p style="color:#374151">Hi <strong>${firstName}</strong>,</p>
          <p style="color:#374151">Click the button below to reset your password:</p>
          <div style="text-align:center;padding:24px 0">
            <a href="${url}" style="background-color:#4A90E2;color:white;text-decoration:none;padding:12px 24px;border-radius:6px;display:inline-block;font-weight:bold">Reset Password</a>
          </div>
          <p style="color:#6b7280;font-size:13px">This link expires in <strong>15 minutes</strong>. Never share it with anyone.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    this.logger.log(`Reset password email sent to ${to}`);
  }
}
