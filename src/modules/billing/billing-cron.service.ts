import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import {
  SubscriptionEntity,
  SubscriptionStatus,
} from './entities/subscription.entity';
import {
  NotificationEntity,
  NotificationType,
} from './entities/notification.entity';
import { AuditLogEntity, AuditAction } from './entities/audit-log.entity';

@Injectable()
export class BillingCronService {
  private readonly logger = new Logger(BillingCronService.name);

  constructor(
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepo: Repository<SubscriptionEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepo: Repository<AuditLogEntity>,
  ) {}

  /**
   * Daily job: Expire subscriptions past their end date
   * Runs every day at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireSubscriptions() {
    this.logger.log('Running subscription expiry check...');

    const now = new Date();
    const expiredSubscriptions = await this.subscriptionRepo.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: LessThan(now),
      },
      relations: { plan: true },
    });

    for (const sub of expiredSubscriptions) {
      await this.subscriptionRepo.update(
        { id: sub.id },
        { status: SubscriptionStatus.EXPIRED },
      );

      // Create notification
      const notification = this.notificationRepo.create({
        type: NotificationType.SUBSCRIPTION_EXPIRED,
        title: 'Subscription Expired',
        message: `Your ${sub.plan.name} subscription has expired. Please renew to continue using full API access.`,
        data: {
          subscriptionId: sub.id,
          planName: sub.plan.name,
          expiredAt: now.toISOString(),
        },
      });
      await this.notificationRepo.save(notification);

      // Create audit log
      const auditLog = this.auditLogRepo.create({
        action: AuditAction.SUBSCRIPTION_EXPIRED,
        description: `Subscription for ${sub.developerName} to ${sub.plan.name} automatically expired`,
        metadata: {
          subscriptionId: sub.id,
          planName: sub.plan.name,
          developerName: sub.developerName,
        },
      });
      await this.auditLogRepo.save(auditLog);

      this.logger.log(
        `Expired subscription ${sub.id} for ${sub.developerName}`,
      );
    }

    this.logger.log(`Expired ${expiredSubscriptions.length} subscriptions`);
  }

  /**
   * Daily job: Notify users about subscriptions expiring in 7 days
   * Runs every day at 8:00 AM
   */
  @Cron('0 8 * * *')
  async notifyExpiringSevenDays() {
    await this.notifyExpiringSoon(7, NotificationType.SUBSCRIPTION_EXPIRING);
  }

  /**
   * Daily job: Notify users about subscriptions expiring in 3 days
   * Runs every day at 8:00 AM
   */
  @Cron('0 8 * * *')
  async notifyExpiringThreeDays() {
    await this.notifyExpiringSoon(3, NotificationType.SUBSCRIPTION_EXPIRING);
  }

  private async notifyExpiringSoon(days: number, type: NotificationType) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const subscriptions = await this.subscriptionRepo.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: MoreThan(startOfDay),
      },
      relations: { plan: true },
    });

    // Filter to exact day
    const exactDaySubs = subscriptions.filter((s) => {
      const end = new Date(s.currentPeriodEnd);
      return end >= startOfDay && end <= endOfDay;
    });

    for (const sub of exactDaySubs) {
      const notification = this.notificationRepo.create({
        type,
        title:
          days === 7
            ? 'Subscription Expiring in 7 Days'
            : 'Subscription Expiring in 3 Days',
        message: `Your ${sub.plan.name} subscription will expire on ${sub.currentPeriodEnd.toLocaleDateString()}. Renew now to avoid service interruption.`,
        data: {
          subscriptionId: sub.id,
          planName: sub.plan.name,
          expiresAt: sub.currentPeriodEnd.toISOString(),
          daysRemaining: days,
        },
      });
      await this.notificationRepo.save(notification);
    }

    if (exactDaySubs.length > 0) {
      this.logger.log(
        `Sent ${days}-day expiry notifications to ${exactDaySubs.length} users`,
      );
    }
  }

  /**
   * Hourly job: Check for newly expired subscriptions and log them
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkExpiredSubscriptions(): Promise<number> {
    const now = new Date();
    const result = await this.subscriptionRepo.update(
      {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: LessThan(now),
      },
      { status: SubscriptionStatus.EXPIRED },
    );

    if (result.affected && result.affected > 0) {
      this.logger.log(`Auto-expired ${result.affected} subscriptions`);
    }

    return result.affected ?? 0;
  }
}
