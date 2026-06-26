import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export interface SendMailResult {
  sent: boolean;
  reason?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly config: SmtpConfig | null;

  constructor() {
    this.config = this.loadSmtpConfig();
    if (this.config) {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.port === 465,
        auth: {
          user: this.config.user,
          pass: this.config.pass,
        },
      });
      this.logger.log(
        `SMTP configured (${this.config.host}:${this.config.port})`,
      );
    } else {
      this.logger.warn(
        'SMTP credentials not configured — verification emails will not be sent. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.',
      );
    }
  }

  isConfigured(): boolean {
    return this.transporter !== null && this.config !== null;
  }

  getSupportEmail(): string {
    return process.env.SUPPORT_EMAIL ?? 'support@kigalipack.rw';
  }

  getFrontendUrl(): string {
    return (
      process.env.FRONTEND_URL ??
      process.env.APP_URL ??
      'http://localhost:3001'
    ).replace(/\/$/, '');
  }

  async sendVerificationEmail(input: {
    to: string;
    token: string;
    expiresAt: Date;
  }): Promise<SendMailResult> {
    const verifyUrl = `${this.getFrontendUrl()}/verify-email?token=${encodeURIComponent(input.token)}`;
    const expiresMinutes = Math.max(
      1,
      Math.round((input.expiresAt.getTime() - Date.now()) / 60_000),
    );
    const supportEmail = this.getSupportEmail();

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Verify your Kigali-Pack account</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 22px; margin-bottom: 8px;">Welcome to Kigali-Pack</h1>
  <p>Thanks for registering. Please verify your email address to continue onboarding and generate API keys.</p>
  <p style="margin: 28px 0;">
    <a href="${verifyUrl}" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">Verify email address</a>
  </p>
  <p style="font-size: 14px; color: #666;">This link expires in <strong>${expiresMinutes} minutes</strong>. If it expires, sign in and request a new verification email from Get Started.</p>
  <p style="font-size: 13px; color: #888;">If the button does not work, copy this URL:<br><span style="word-break: break-all;">${verifyUrl}</span></p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="font-size: 13px; color: #888;">Need help? Contact <a href="mailto:${supportEmail}">${supportEmail}</a></p>
</body>
</html>`;

    const text = `Welcome to Kigali-Pack

Verify your email: ${verifyUrl}

This link expires in ${expiresMinutes} minutes.

Need help? ${supportEmail}`;

    return this.sendMail({
      to: input.to,
      subject: 'Verify your Kigali-Pack account',
      html,
      text,
    });
  }

  private async sendMail(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<SendMailResult> {
    if (!this.transporter || !this.config) {
      this.logger.warn(
        `Email not sent to ${options.to}: SMTP is not configured`,
      );
      return { sent: false, reason: 'SMTP_NOT_CONFIGURED' };
    }

    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      this.logger.log(`Verification email sent to ${options.to}`);
      return { sent: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown mail error';
      this.logger.error(
        `Failed to send email to ${options.to}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      return { sent: false, reason: message };
    }
  }

  private loadSmtpConfig(): SmtpConfig | null {
    const host = process.env.SMTP_HOST?.trim();
    const portRaw = process.env.SMTP_PORT?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const from = process.env.SMTP_FROM?.trim();

    const missing = [
      !host && 'SMTP_HOST',
      !portRaw && 'SMTP_PORT',
      !user && 'SMTP_USER',
      !pass && 'SMTP_PASS',
      !from && 'SMTP_FROM',
    ].filter(Boolean);

    if (missing.length > 0) {
      return null;
    }

    const port = parseInt(portRaw!, 10);
    if (Number.isNaN(port) || port <= 0) {
      this.logger.warn('SMTP_PORT is invalid — email delivery disabled');
      return null;
    }

    return { host: host!, port, user: user!, pass: pass!, from: from! };
  }
}
