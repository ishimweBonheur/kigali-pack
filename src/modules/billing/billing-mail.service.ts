import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../../common/mail/mail.service';

export interface BillingEmailEvent {
  to: string;
  userName: string;
  planName: string;
  amount?: number;
  currency?: string;
  reason?: string;
  expiryDate?: string;
}

@Injectable()
export class BillingMailService {
  private readonly logger = new Logger(BillingMailService.name);

  constructor(private readonly mailService: MailService) {}

  async sendPaymentSubmitted(event: BillingEmailEvent) {
    const subject = `Payment Request Submitted - ${event.planName} Plan`;
    const html = this.template(
      'Payment Request Submitted',
      event.userName,
      `Your payment request for the <strong>${event.planName}</strong> plan has been submitted successfully.`,
      `Amount: ${event.amount?.toLocaleString()} ${event.currency ?? 'RWF'}`,
      'Your request is now pending review by our team. You will be notified once it is approved.',
      'We typically process payments within 24 hours.',
    );
    return this.mailService.sendMailInternal({
      to: event.to,
      subject,
      html,
      text: subject,
    });
  }

  async sendPaymentApproved(event: BillingEmailEvent) {
    const subject = `Payment Approved - ${event.planName} Plan`;
    const html = this.template(
      'Payment Approved',
      event.userName,
      `Your payment of <strong>${event.amount?.toLocaleString()} ${event.currency ?? 'RWF'}</strong> for the <strong>${event.planName}</strong> plan has been approved.`,
      'Your subscription is now active!',
      'You can now access all the features included in your plan.',
      `Plan: ${event.planName} | Amount: ${event.amount?.toLocaleString()} ${event.currency ?? 'RWF'}`,
      '/dashboard/billing',
    );
    return this.mailService.sendMailInternal({
      to: event.to,
      subject,
      html,
      text: subject,
    });
  }

  async sendPaymentRejected(event: BillingEmailEvent) {
    const subject = `Payment Rejected - ${event.planName} Plan`;
    const html = this.template(
      'Payment Rejected',
      event.userName,
      `Your payment of <strong>${event.amount?.toLocaleString()} ${event.currency ?? 'RWF'}</strong> for the <strong>${event.planName}</strong> plan has been rejected.`,
      `Reason: ${event.reason ?? 'No reason provided'}`,
      'Please submit a new payment request with the correct information.',
      'If you believe this is an error, please contact support.',
    );
    return this.mailService.sendMailInternal({
      to: event.to,
      subject,
      html,
      text: subject,
    });
  }

  async sendSubscriptionActivated(event: BillingEmailEvent) {
    const subject = `Subscription Activated - ${event.planName} Plan`;
    const html = this.template(
      'Subscription Activated',
      event.userName,
      `Your <strong>${event.planName}</strong> subscription is now active.`,
      `Expires: ${event.expiryDate ?? 'N/A'}`,
      'You now have full access to your plan features.',
      '/dashboard/billing',
    );
    return this.mailService.sendMailInternal({
      to: event.to,
      subject,
      html,
      text: subject,
    });
  }

  async sendSubscriptionExpiringSoon(event: BillingEmailEvent) {
    const subject = `Subscription Expiring Soon - ${event.planName}`;
    const html = this.template(
      'Subscription Expiring Soon',
      event.userName,
      `Your <strong>${event.planName}</strong> subscription will expire on <strong>${event.expiryDate ?? 'N/A'}</strong>.`,
      'Please renew your subscription to avoid service interruption.',
      'If you have already submitted payment, please disregard this message.',
      '/dashboard/billing',
    );
    return this.mailService.sendMailInternal({
      to: event.to,
      subject,
      html,
      text: subject,
    });
  }

  async sendSubscriptionExpired(event: BillingEmailEvent) {
    const subject = `Subscription Expired - ${event.planName}`;
    const html = this.template(
      'Subscription Expired',
      event.userName,
      `Your <strong>${event.planName}</strong> subscription has expired.`,
      'Your API access has been limited.',
      'Please renew your subscription to restore full access.',
      '/dashboard/billing',
    );
    return this.mailService.sendMailInternal({
      to: event.to,
      subject,
      html,
      text: subject,
    });
  }

  async sendPlanChanged(event: BillingEmailEvent) {
    const subject = `Plan Changed - ${event.planName}`;
    const html = this.template(
      'Plan Changed',
      event.userName,
      `Your plan has been changed to <strong>${event.planName}</strong>.`,
      event.amount
        ? `New price: ${event.amount.toLocaleString()} ${event.currency ?? 'RWF'}/month`
        : '',
      'Your new plan features are now active.',
      '/dashboard/billing',
    );
    return this.mailService.sendMailInternal({
      to: event.to,
      subject,
      html,
      text: subject,
    });
  }

  private template(
    title: string,
    userName: string,
    mainMessage: string,
    highlight: string,
    actionMessage: string,
    details: string,
    ctaUrl?: string,
  ): string {
    const frontendUrl = this.mailService.getFrontendUrl();
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #e2e8f0; background: #0f172a; max-width: 560px; margin: 0 auto; padding: 24px;">
  <div style="background: #1e293b; border-radius: 12px; padding: 32px; border: 1px solid #334155;">
    <h1 style="font-size: 20px; margin-bottom: 16px; color: #38bdf8;">${title}</h1>
    <p style="color: #94a3b8;">Hi ${userName},</p>
    <p style="color: #e2e8f0;">${mainMessage}</p>
    ${highlight ? `<p style="font-size: 18px; font-weight: 600; color: #38bdf8; margin: 20px 0;">${highlight}</p>` : ''}
    <p style="color: #94a3b8;">${actionMessage}</p>
    ${ctaUrl ? `<p style="margin: 24px 0;"><a href="${frontendUrl}${ctaUrl}" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">Go to Dashboard</a></p>` : ''}
    <hr style="border: none; border-top: 1px solid #334155; margin: 24px 0;">
    <p style="font-size: 13px; color: #64748b;">${details}</p>
    <p style="font-size: 13px; color: #64748b;">Need help? Contact <a href="mailto:support@kigalipack.rw" style="color: #38bdf8;">support@kigalipack.rw</a></p>
  </div>
</body>
</html>`;
  }
}
