import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SubscriptionEntity,
  SubscriptionStatus,
} from '../entities/subscription.entity';
import { ApiKeyEntity } from '../../auth/entities/api-key.entity';

/**
 * Guard that checks if the developer has an active subscription.
 * Returns a structured error if subscription is expired or missing.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepo: Repository<SubscriptionEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      developer?: ApiKeyEntity;
      member?: { orgId?: string; sub?: string };
    }>();

    let developerName: string | undefined;

    // Check for API key based auth
    if (request.developer?.developerName) {
      developerName = request.developer.developerName;
    }

    if (!developerName) {
      // Allow requests without subscription check if no developer context
      return true;
    }

    const subscription = await this.subscriptionRepo.findOne({
      where: {
        developerName,
        status: SubscriptionStatus.ACTIVE,
      },
      relations: { plan: true },
      order: { createdAt: 'DESC' },
    });

    if (!subscription) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'SUBSCRIPTION_REQUIRED',
          message: 'Your subscription has expired. Please renew your plan.',
        },
      });
    }

    // Check if subscription is expired
    if (new Date() > new Date(subscription.currentPeriodEnd)) {
      // Auto-expire
      await this.subscriptionRepo.update(
        { id: subscription.id },
        { status: SubscriptionStatus.EXPIRED },
      );

      throw new ForbiddenException({
        success: false,
        error: {
          code: 'SUBSCRIPTION_REQUIRED',
          message: 'Your subscription has expired. Please renew your plan.',
        },
      });
    }

    return true;
  }
}
