import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { ApiKeyEntity } from '../auth/entities/api-key.entity';
import { ApiLogEntity } from '../analytics/entities/api-log.entity';
import { ApiUsageEntity } from '../analytics/entities/api-usage.entity';
import {
  SubscriptionEntity,
  SubscriptionStatus,
} from '../billing/entities/subscription.entity';
import {
  InvoiceEntity,
  InvoiceStatus,
} from '../billing/entities/invoice.entity';
import { PlanEntity } from '../billing/entities/plan.entity';
import {
  OrganizationMemberEntity,
  OrganizationRole,
} from '../organizations/entities/organization-member.entity';
import { OrganizationEntity } from '../organizations/entities/organization.entity';
import {
  WebhookDeliveryEntity,
  WebhookDeliveryStatus,
} from '../webhooks/entities/webhook-delivery.entity';
import {
  AdminDevelopersQueryDto,
  AdminOverviewMetrics,
  AdminSubscriptionsQueryDto,
  AdminTelemetryQueryDto,
  InvoiceStatusDto,
  RestrictDeveloperDto,
  TierOverrideDto,
} from './dto/admin.dto';
import {
  buildPaginationMeta,
  paginateOffset,
} from '../../common/utils/pagination.util';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly apiKeyRepo: Repository<ApiKeyEntity>,
    @InjectRepository(ApiLogEntity)
    private readonly apiLogRepo: Repository<ApiLogEntity>,
    @InjectRepository(ApiUsageEntity)
    private readonly usageRepo: Repository<ApiUsageEntity>,
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepo: Repository<SubscriptionEntity>,
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepo: Repository<InvoiceEntity>,
    @InjectRepository(PlanEntity)
    private readonly planRepo: Repository<PlanEntity>,
    @InjectRepository(OrganizationMemberEntity)
    private readonly memberRepo: Repository<OrganizationMemberEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly orgRepo: Repository<OrganizationEntity>,
    @InjectRepository(WebhookDeliveryEntity)
    private readonly deliveryRepo: Repository<WebhookDeliveryEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async getOverview(): Promise<AdminOverviewMetrics> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const usageDateFrom = thirtyDaysAgo.toISOString().slice(0, 10);

    const [
      totalOrganizations,
      totalActiveApiKeys,
      mrrResult,
      latencyResult,
      errorResult,
    ] = await Promise.all([
      this.orgRepo.count(),
      this.apiKeyRepo.count({ where: { isActive: true } }),
      this.subscriptionRepo
        .createQueryBuilder('sub')
        .innerJoin('sub.plan', 'plan')
        .select('COALESCE(SUM(plan.price_monthly_rwf), 0)', 'mrr')
        .where('sub.status = :status', { status: SubscriptionStatus.ACTIVE })
        .getRawOne<{ mrr: string }>(),
      this.usageRepo
        .createQueryBuilder('usage')
        .select(
          'SUM(usage.average_latency_ms * usage.requests) / NULLIF(SUM(usage.requests), 0)',
          'avgMs',
        )
        .where('usage.usage_date >= :from', { from: usageDateFrom })
        .getRawOne<{ avgMs: string | null }>(),
      this.usageRepo
        .createQueryBuilder('usage')
        .select('COALESCE(SUM(usage.error_count), 0)', 'errors')
        .addSelect('COALESCE(SUM(usage.requests), 0)', 'requests')
        .where('usage.usage_date >= :from', { from: usageDateFrom })
        .getRawOne<{ errors: string; requests: string }>(),
    ]);

    const totalErrors = Number(errorResult?.errors ?? 0);
    const totalRequests = Number(errorResult?.requests ?? 0);

    return {
      totalOrganizations,
      totalActiveApiKeys,
      totalMrrRwf: Number(mrrResult?.mrr ?? 0),
      globalAverageLatencyMs: Math.round(Number(latencyResult?.avgMs ?? 0)),
      globalErrorRate:
        totalRequests > 0 ? totalErrors / totalRequests : 0,
    };
  }

  async listSubscriptions(query: AdminSubscriptionsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = paginateOffset(page, limit);

    const qb = this.subscriptionRepo
      .createQueryBuilder('sub')
      .leftJoinAndSelect('sub.plan', 'plan')
      .orderBy('sub.created_at', 'DESC');

    if (query.status) {
      qb.andWhere('sub.status = :status', { status: query.status });
    }
    if (query.tier) {
      qb.andWhere('plan.code = :tier', { tier: query.tier.toUpperCase() });
    }

    const [rows, total] = await qb.skip(offset).take(limit).getManyAndCount();

    return {
      pagination: buildPaginationMeta(page, limit, total),
      data: rows.map((sub) => ({
        id: sub.id,
        developerName: sub.developerName,
        status: sub.status,
        plan: {
          code: sub.plan.code,
          name: sub.plan.name,
          priceMonthlyRwf: Number(sub.plan.priceMonthlyRwf),
          rateLimitPerHour: sub.plan.rateLimitPerHour,
        },
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        createdAt: sub.createdAt,
      })),
    };
  }

  async overrideSubscriptionTier(id: string, dto: TierOverrideDto) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { id },
      relations: { plan: true },
    });
    if (!subscription) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }

    return this.dataSource.transaction(async (manager) => {
      const subRepo = manager.getRepository(SubscriptionEntity);
      const planRepo = manager.getRepository(PlanEntity);
      const keyRepo = manager.getRepository(ApiKeyEntity);

      if (dto.planCode) {
        const plan = await planRepo.findOne({
          where: { code: dto.planCode.toUpperCase(), isActive: true },
        });
        if (!plan) {
          throw new BadRequestException(`Plan ${dto.planCode} not found`);
        }
        subscription.plan = plan;
        await keyRepo.update(
          { developerName: subscription.developerName, isActive: true },
          { tier: plan.code as ApiKeyEntity['tier'] },
        );
      }

      if (dto.rateLimitPerHour !== undefined && subscription.plan) {
        subscription.plan.rateLimitPerHour = dto.rateLimitPerHour;
        await planRepo.save(subscription.plan);
      }

      if (dto.status) {
        subscription.status = dto.status;
        if (dto.status === SubscriptionStatus.CANCELLED) {
          subscription.cancelledAt = new Date();
        }
      }

      const saved = await subRepo.save(subscription);
      return {
        id: saved.id,
        developerName: saved.developerName,
        status: saved.status,
        planCode: saved.plan.code,
        rateLimitPerHour: saved.plan.rateLimitPerHour,
        message: 'Subscription tier and limits updated',
      };
    });
  }

  async updateInvoiceStatus(id: string, dto: InvoiceStatusDto) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: { subscription: true },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    invoice.status = dto.status;
    if (dto.status === InvoiceStatus.PAID) {
      invoice.paidAt = new Date();
    }
    await this.invoiceRepo.save(invoice);

    return {
      id: invoice.id,
      status: invoice.status,
      paidAt: invoice.paidAt,
      message: 'Invoice status updated',
    };
  }

  async listDevelopers(query: AdminDevelopersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = paginateOffset(page, limit);

    const qb = this.memberRepo
      .createQueryBuilder('member')
      .leftJoinAndSelect('member.organization', 'org')
      .orderBy('member.created_at', 'DESC');

    if (query.search) {
      qb.andWhere('member.email ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    const [members, total] = await qb.skip(offset).take(limit).getManyAndCount();

    const data = await Promise.all(
      members.map(async (member) => {
        const apiKeys = await this.apiKeyRepo.find({
          where: { developerName: member.organization.slug },
        });
        const usage = await this.usageRepo
          .createQueryBuilder('usage')
          .select('COALESCE(SUM(usage.requests), 0)', 'total')
          .where('usage.api_key_id IN (:...ids)', {
            ids: apiKeys.map((k) => k.id).length
              ? apiKeys.map((k) => k.id)
              : ['00000000-0000-0000-0000-000000000000'],
          })
          .getRawOne<{ total: string }>();

        return {
          id: member.id,
          email: member.email,
          role: member.role,
          emailVerified: member.emailVerified,
          organization: {
            id: member.organization.id,
            name: member.organization.name,
            slug: member.organization.slug,
          },
          apiKeyCount: apiKeys.length,
          activeApiKeys: apiKeys.filter((k) => k.isActive).length,
          totalRequests: Number(usage?.total ?? 0),
          createdAt: member.createdAt,
        };
      }),
    );

    return {
      pagination: buildPaginationMeta(page, limit, total),
      data,
    };
  }

  async restrictDeveloper(memberId: string, dto: RestrictDeveloperDto) {
    const member = await this.memberRepo.findOne({
      where: { id: memberId },
      relations: { organization: true },
    });
    if (!member) {
      throw new NotFoundException(`Developer ${memberId} not found`);
    }

    if (member.role === OrganizationRole.MASTER_ADMIN) {
      throw new BadRequestException('Cannot restrict master admin accounts');
    }

    await this.apiKeyRepo.update(
      { developerName: member.organization.slug },
      { isActive: false, revokedAt: new Date() },
    );

    return {
      memberId: member.id,
      email: member.email,
      organizationSlug: member.organization.slug,
      reason: dto.reason ?? 'Administrative suspension',
      message: 'Developer API keys suspended',
    };
  }

  async getTelemetryLiveStream(query: AdminTelemetryQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);
    const offset = paginateOffset(page, limit);

    const qb = this.apiLogRepo
      .createQueryBuilder('log')
      .orderBy('log.timestamp', 'DESC');

    if (query.statusCode) {
      qb.andWhere('log.status_code = :statusCode', {
        statusCode: query.statusCode,
      });
    }

    const [logs, total] = await qb.skip(offset).take(limit).getManyAndCount();

    return {
      pagination: buildPaginationMeta(page, limit, total),
      data: logs.map((log) => ({
        id: log.id,
        developerId: log.developerId,
        routePath: log.endpoint,
        httpMethod: log.method,
        httpStatusCode: log.statusCode,
        executionTimeMs: log.responseTimeMs,
        processingMode: log.processingMode,
        maskedRequestSnapshot: log.maskedRequestSnapshot,
        maskedResponseSnapshot: log.maskedResponseSnapshot,
        timestamp: log.timestamp,
      })),
    };
  }

  async listWebhookFailures(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = paginateOffset(page, limit);

    const [deliveries, total] = await this.deliveryRepo.findAndCount({
      where: {
        status: In([WebhookDeliveryStatus.FAILED, WebhookDeliveryStatus.DLQ]),
      },
      relations: { webhook: { apiKey: true } },
      order: { lastAttemptAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    return {
      pagination: buildPaginationMeta(page, limit, total),
      data: deliveries.map((d) => ({
        id: d.id,
        eventType: d.eventType,
        status: d.status,
        attemptCount: d.attemptCount,
        errorMessage: d.errorMessage,
        responseStatus: d.responseStatus,
        webhookUrl: d.webhook.url,
        developerName: d.webhook.apiKey?.developerName ?? null,
        lastAttemptAt: d.lastAttemptAt,
        createdAt: d.createdAt,
      })),
    };
  }
}
