import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  SubscriptionEntity,
  SubscriptionStatus,
} from './entities/subscription.entity';
import { PlanEntity } from './entities/plan.entity';
import { InvoiceEntity, InvoiceStatus } from './entities/invoice.entity';
import { ApiKeyEntity } from '../auth/entities/api-key.entity';
import { ApiKeyTier } from '../auth/enums/api-key.enum';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(PlanEntity)
    private readonly planRepo: Repository<PlanEntity>,
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepo: Repository<SubscriptionEntity>,
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepo: Repository<InvoiceEntity>,
    @InjectRepository(ApiKeyEntity)
    private readonly apiKeyRepo: Repository<ApiKeyEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async listPlans() {
    const plans = await this.planRepo.find({
      where: { isActive: true },
      order: { priceMonthlyRwf: 'ASC' },
    });
    return plans.map((plan) => this.toPlanResponse(plan));
  }

  async getSubscription(developerName: string) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { developerName, status: SubscriptionStatus.ACTIVE },
      relations: { plan: true },
      order: { createdAt: 'DESC' },
    });

    if (!subscription) {
      return { active: false, subscription: null };
    }

    return {
      active: true,
      subscription: this.toSubscriptionResponse(subscription),
    };
  }

  async subscribe(developer: ApiKeyEntity, planCode: string) {
    const plan = await this.planRepo.findOne({
      where: { code: planCode.toUpperCase(), isActive: true },
    });
    if (!plan) {
      throw new NotFoundException(`Plan ${planCode} not found`);
    }

    return this.dataSource.transaction(async (manager) => {
      const subRepo = manager.getRepository(SubscriptionEntity);
      const invoiceRepo = manager.getRepository(InvoiceEntity);
      const keyRepo = manager.getRepository(ApiKeyEntity);

      const existing = await subRepo.findOne({
        where: {
          developerName: developer.developerName,
          status: SubscriptionStatus.ACTIVE,
        },
      });

      if (existing) {
        existing.status = SubscriptionStatus.CANCELLED;
        existing.cancelledAt = new Date();
        await subRepo.save(existing);
      }

      const periodStart = new Date();
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const subscription = subRepo.create({
        developerName: developer.developerName,
        plan,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      });
      const savedSub = await subRepo.save(subscription);

      const dueDate = periodEnd.toISOString().slice(0, 10);
      const invoice = invoiceRepo.create({
        subscription: savedSub,
        amountRwf: plan.priceMonthlyRwf,
        status: Number(plan.priceMonthlyRwf) === 0 ? InvoiceStatus.PAID : InvoiceStatus.OPEN,
        dueDate,
        paidAt: Number(plan.priceMonthlyRwf) === 0 ? new Date() : null,
      });
      await invoiceRepo.save(invoice);

      await keyRepo.update(
        { developerName: developer.developerName, isActive: true },
        { tier: plan.code as ApiKeyTier },
      );

      developer.tier = plan.code as ApiKeyTier;

      return {
        subscription: this.toSubscriptionResponse(savedSub),
        invoice: {
          id: invoice.id,
          amountRwf: Number(invoice.amountRwf),
          status: invoice.status,
          dueDate: invoice.dueDate,
        },
        message: `Subscribed to ${plan.name}. MTN MoMo payment integration ready for future billing.`,
      };
    });
  }

  async cancel(developer: ApiKeyEntity) {
    const subscription = await this.subscriptionRepo.findOne({
      where: {
        developerName: developer.developerName,
        status: SubscriptionStatus.ACTIVE,
      },
      relations: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelledAt = new Date();
    await this.subscriptionRepo.save(subscription);

    const freePlan = await this.planRepo.findOne({ where: { code: 'FREE' } });
    if (freePlan) {
      await this.apiKeyRepo.update(
        { developerName: developer.developerName, isActive: true },
        { tier: ApiKeyTier.FREE },
      );
    }

    return {
      cancelled: true,
      cancelledAt: subscription.cancelledAt,
      downgradedTo: ApiKeyTier.FREE,
    };
  }

  private toPlanResponse(plan: PlanEntity) {
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      priceMonthlyRwf: Number(plan.priceMonthlyRwf),
      rateLimitPerHour: plan.rateLimitPerHour,
      features: plan.features,
    };
  }

  private toSubscriptionResponse(subscription: SubscriptionEntity) {
    return {
      id: subscription.id,
      plan: this.toPlanResponse(subscription.plan),
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelledAt: subscription.cancelledAt,
      momoReference: subscription.momoReference,
    };
  }
}
