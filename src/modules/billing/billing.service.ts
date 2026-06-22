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
import { ApiUsageEntity } from '../analytics/entities/api-usage.entity';
import { JwtPayload } from '../organizations/organization.service';
import { OrganizationEntity } from '../organizations/entities/organization.entity';
import {
  InvoiceListItem,
  UsageCounterResponse,
} from './dto/invoice.dto';

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
    @InjectRepository(OrganizationEntity)
    private readonly orgRepo: Repository<OrganizationEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async resolveDeveloperNameFromJwt(member: JwtPayload): Promise<string> {
    const org = await this.orgRepo.findOne({ where: { id: member.orgId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org.slug;
  }

  async resolveApiKeyFromJwt(member: JwtPayload): Promise<ApiKeyEntity> {
    const developerName = await this.resolveDeveloperNameFromJwt(member);
    const apiKey = await this.apiKeyRepo.findOne({
      where: { developerName, isActive: true },
      order: { createdAt: 'DESC' },
    });

    if (!apiKey) {
      throw new NotFoundException(
        'No active API key found for organization. Create an API key first.',
      );
    }

    return apiKey;
  }

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

  async listInvoices(member: JwtPayload): Promise<InvoiceListItem[]> {
    const developerName = await this.resolveDeveloperNameFromJwt(member);

    const subscriptions = await this.subscriptionRepo.find({
      where: { developerName },
      relations: { invoices: true },
      order: { createdAt: 'DESC' },
    });

    const invoices = subscriptions.flatMap((sub) =>
      (sub.invoices ?? []).map((invoice) =>
        this.toInvoiceListItem(invoice, sub),
      ),
    );

    return invoices.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async getInvoiceById(
    member: JwtPayload,
    invoiceId: string,
  ): Promise<InvoiceListItem> {
    const developerName = await this.resolveDeveloperNameFromJwt(member);

    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId },
      relations: { subscription: true },
    });

    if (!invoice || invoice.subscription.developerName !== developerName) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    return this.toInvoiceListItem(invoice, invoice.subscription);
  }

  async getUsageCounter(member: JwtPayload): Promise<UsageCounterResponse> {
    const developerName = await this.resolveDeveloperNameFromJwt(member);
    const apiKey = await this.resolveApiKeyFromJwt(member);

    const subscription = await this.subscriptionRepo.findOne({
      where: { developerName, status: SubscriptionStatus.ACTIVE },
      relations: { plan: true },
      order: { createdAt: 'DESC' },
    });

    const plan = subscription?.plan ?? (await this.planRepo.findOne({ where: { code: 'FREE' } }));
    const planLimit = plan?.rateLimitPerHour
      ? plan.rateLimitPerHour * 24 * 30
      : 100 * 24 * 30;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const usageResult = await this.dataSource
      .getRepository(ApiUsageEntity)
      .createQueryBuilder('usage')
      .select('COALESCE(SUM(usage.requests), 0)', 'total')
      .where('usage.api_key_id = :apiKeyId', { apiKeyId: apiKey.id })
      .andWhere('usage.usage_date >= :from', {
        from: monthStart.toISOString().slice(0, 10),
      })
      .andWhere('usage.usage_date < :to', {
        to: monthEnd.toISOString().slice(0, 10),
      })
      .getRawOne<{ total: string }>();

    const currentUsage = Number(usageResult?.total ?? 0);

    return {
      currentUsage,
      planLimit,
      planCode: plan?.code ?? 'FREE',
      usagePercent:
        planLimit > 0 ? Math.round((currentUsage / planLimit) * 10000) / 100 : 0,
      resettingAt: monthEnd.toISOString(),
    };
  }

  private toInvoiceListItem(
    invoice: InvoiceEntity,
    subscription: SubscriptionEntity,
  ): InvoiceListItem {
    const shortId = invoice.id.replace(/-/g, '').slice(0, 8).toUpperCase();
    const year = invoice.createdAt.getFullYear();

    return {
      id: invoice.id,
      invoiceNumber: `INV-${year}-${shortId}`,
      amount: Number(invoice.amountRwf),
      currency: 'RWF',
      status: invoice.status === InvoiceStatus.PAID ? 'PAID' : 'UNPAID',
      billingPeriod: {
        start: subscription.currentPeriodStart,
        end: subscription.currentPeriodEnd,
      },
      createdAt: invoice.createdAt,
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
