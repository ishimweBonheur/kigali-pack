import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  SubscriptionEntity,
  SubscriptionStatus,
} from './entities/subscription.entity';
import { PlanEntity } from './entities/plan.entity';
import { InvoiceEntity, InvoiceStatus } from './entities/invoice.entity';
import {
  PaymentRequestEntity,
  PaymentRequestStatus,
} from './entities/payment-request.entity';
import { AuditLogEntity, AuditAction } from './entities/audit-log.entity';
import {
  NotificationEntity,
  NotificationType,
} from './entities/notification.entity';
import { ApiKeyEntity } from '../auth/entities/api-key.entity';
import { ApiKeyTier } from '../auth/enums/api-key.enum';
import {
  OrganizationMemberEntity,
  OrganizationRole,
} from '../organizations/entities/organization-member.entity';
import { OrganizationEntity } from '../organizations/entities/organization.entity';
import {
  buildPaginationMeta,
  paginateOffset,
} from '../../common/utils/pagination.util';
import { JwtPayload } from '../organizations/organization.service';

@Injectable()
export class BillingAdminService {
  private readonly logger = new Logger(BillingAdminService.name);

  constructor(
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepo: Repository<SubscriptionEntity>,
    @InjectRepository(PlanEntity)
    private readonly planRepo: Repository<PlanEntity>,
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepo: Repository<InvoiceEntity>,
    @InjectRepository(PaymentRequestEntity)
    private readonly paymentRequestRepo: Repository<PaymentRequestEntity>,
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepo: Repository<AuditLogEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
    @InjectRepository(ApiKeyEntity)
    private readonly apiKeyRepo: Repository<ApiKeyEntity>,
    @InjectRepository(OrganizationMemberEntity)
    private readonly memberRepo: Repository<OrganizationMemberEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly orgRepo: Repository<OrganizationEntity>,
    private readonly dataSource: DataSource,
  ) {}

  // ==================== DASHBOARD OVERVIEW ====================

  async getAdminDashboardStats() {
    const [
      totalUsers,
      activeUsers,
      verifiedUsers,
      activeSubscriptions,
      pendingPayments,
      approvedPayments,
      rejectedPayments,
      monthlyRevenue,
    ] = await Promise.all([
      this.memberRepo.count(),
      this.memberRepo.count({ where: {} }),
      this.memberRepo.count({ where: { emailVerified: true } }),
      this.subscriptionRepo.count({
        where: { status: SubscriptionStatus.ACTIVE },
      }),
      this.paymentRequestRepo.count({
        where: { status: PaymentRequestStatus.PENDING },
      }),
      this.paymentRequestRepo.count({
        where: { status: PaymentRequestStatus.APPROVED },
      }),
      this.paymentRequestRepo.count({
        where: { status: PaymentRequestStatus.REJECTED },
      }),
      this.paymentRequestRepo
        .createQueryBuilder('pr')
        .select('COALESCE(SUM(pr.amount), 0)', 'total')
        .where('pr.status = :status', { status: PaymentRequestStatus.APPROVED })
        .andWhere("pr.created_at >= date_trunc('month', now())")
        .getRawOne<{ total: string }>(),
    ]);

    const popularPlans = await this.subscriptionRepo
      .createQueryBuilder('sub')
      .select('plan.name', 'name')
      .addSelect('plan.code', 'code')
      .addSelect('COUNT(sub.id)', 'count')
      .innerJoin('sub.plan', 'plan')
      .where('sub.status = :status', { status: SubscriptionStatus.ACTIVE })
      .groupBy('plan.name')
      .addGroupBy('plan.code')
      .orderBy('COUNT(sub.id)', 'DESC')
      .limit(5)
      .getRawMany();

    return {
      totalUsers,
      activeUsers,
      verifiedUsers,
      activeSubscriptions,
      pendingPayments,
      approvedPayments,
      rejectedPayments,
      monthlyRevenue: Number(monthlyRevenue?.total ?? 0),
      popularPlans,
    };
  }

  // ==================== PAYMENT MANAGEMENT ====================

  async listPaymentRequests(query: {
    page?: number;
    limit?: number;
    status?: PaymentRequestStatus;
    search?: string;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = paginateOffset(page, limit);

    const qb = this.paymentRequestRepo
      .createQueryBuilder('pr')
      .orderBy('pr.created_at', 'DESC');

    if (query.status) {
      qb.andWhere('pr.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        '(pr.user_email ILIKE :search OR pr.transaction_reference ILIKE :search OR pr.plan_name ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [rows, total] = await qb.skip(offset).take(limit).getManyAndCount();

    return {
      pagination: buildPaginationMeta(page, limit, total),
      data: rows.map((pr) => ({
        id: pr.id,
        userId: pr.userId,
        userEmail: pr.userEmail,
        subscriptionId: pr.subscriptionId,
        planName: pr.planName,
        amount: Number(pr.amount),
        currency: pr.currency,
        paymentMethod: pr.paymentMethod,
        transactionReference: pr.transactionReference,
        paymentProof: pr.paymentProof,
        notes: pr.notes,
        status: pr.status,
        adminNotes: pr.adminNotes,
        rejectionReason: pr.rejectionReason,
        reviewedBy: pr.reviewedBy,
        reviewedByEmail: pr.reviewedByEmail,
        reviewedAt: pr.reviewedAt,
        createdAt: pr.createdAt,
      })),
    };
  }

  async getPaymentRequest(id: string) {
    const pr = await this.paymentRequestRepo.findOne({ where: { id } });
    if (!pr) {
      throw new NotFoundException(`Payment request ${id} not found`);
    }
    return {
      id: pr.id,
      userId: pr.userId,
      userEmail: pr.userEmail,
      subscriptionId: pr.subscriptionId,
      planName: pr.planName,
      amount: Number(pr.amount),
      currency: pr.currency,
      paymentMethod: pr.paymentMethod,
      transactionReference: pr.transactionReference,
      paymentProof: pr.paymentProof,
      notes: pr.notes,
      status: pr.status,
      adminNotes: pr.adminNotes,
      rejectionReason: pr.rejectionReason,
      reviewedBy: pr.reviewedBy,
      reviewedByEmail: pr.reviewedByEmail,
      reviewedAt: pr.reviewedAt,
      createdAt: pr.createdAt,
    };
  }

  async approvePayment(
    paymentRequestId: string,
    admin: JwtPayload,
    adminNotes?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const prRepo = manager.getRepository(PaymentRequestEntity);
      const subRepo = manager.getRepository(SubscriptionEntity);
      const planRepo = manager.getRepository(PlanEntity);
      const invoiceRepo = manager.getRepository(InvoiceEntity);
      const keyRepo = manager.getRepository(ApiKeyEntity);
      const auditRepo = manager.getRepository(AuditLogEntity);
      const notifRepo = manager.getRepository(NotificationEntity);
      const memberRepo = manager.getRepository(OrganizationMemberEntity);

      const paymentRequest = await prRepo.findOne({
        where: { id: paymentRequestId },
      });
      if (!paymentRequest) {
        throw new NotFoundException(
          `Payment request ${paymentRequestId} not found`,
        );
      }
      if (paymentRequest.status !== PaymentRequestStatus.PENDING) {
        throw new BadRequestException(
          `Payment request is already ${paymentRequest.status}`,
        );
      }

      paymentRequest.status = PaymentRequestStatus.APPROVED;
      paymentRequest.reviewedBy = admin.sub;
      paymentRequest.reviewedByEmail = admin.email;
      paymentRequest.reviewedAt = new Date();
      paymentRequest.adminNotes = adminNotes ?? null;
      await prRepo.save(paymentRequest);

      let subscription: SubscriptionEntity | null = null;
      if (paymentRequest.subscriptionId) {
        subscription = await subRepo.findOne({
          where: { id: paymentRequest.subscriptionId },
          relations: { plan: true },
        });
      }

      if (!subscription) {
        const plan = await planRepo.findOne({
          where: { id: paymentRequest.planId ?? undefined },
        });
        if (!plan) {
          throw new NotFoundException('Plan not found for payment request');
        }

        const member = await memberRepo.findOne({
          where: { id: paymentRequest.userId },
          relations: { organization: true },
        });
        if (!member) {
          throw new NotFoundException('User not found');
        }

        const periodStart = new Date();
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        subscription = subRepo.create({
          developerName: member.organization.slug,
          plan,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        });
        subscription = await subRepo.save(subscription);
      } else {
        const periodStart = new Date();
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        subscription.status = SubscriptionStatus.ACTIVE;
        subscription.currentPeriodStart = periodStart;
        subscription.currentPeriodEnd = periodEnd;
        await subRepo.save(subscription);
      }

      const dueDate = subscription.currentPeriodEnd.toISOString().slice(0, 10);
      const invoice = invoiceRepo.create({
        subscription,
        amountRwf: paymentRequest.amount,
        status: InvoiceStatus.PAID,
        dueDate,
        paidAt: new Date(),
      });
      await invoiceRepo.save(invoice);

      const member = await memberRepo.findOne({
        where: { id: paymentRequest.userId },
        relations: { organization: true },
      });
      if (member) {
        const plan = await planRepo.findOne({
          where: { id: paymentRequest.planId ?? undefined },
        });
        if (plan) {
          await keyRepo.update(
            {
              developerName: member.organization.slug,
              isActive: true,
            },
            { tier: plan.code as ApiKeyTier },
          );
        }
      }

      const auditLog = auditRepo.create({
        action: AuditAction.PAYMENT_APPROVED,
        actorId: admin.sub,
        actorEmail: admin.email,
        actorRole: admin.role,
        targetId: paymentRequest.userId,
        targetEmail: paymentRequest.userEmail,
        targetType: 'payment_request',
        description: `Payment of ${Number(paymentRequest.amount).toLocaleString()} ${paymentRequest.currency} for ${paymentRequest.planName} approved`,
        metadata: {
          paymentRequestId: paymentRequest.id,
          amount: Number(paymentRequest.amount),
          currency: paymentRequest.currency,
          planName: paymentRequest.planName,
          subscriptionId: subscription.id,
        },
      });
      await auditRepo.save(auditLog);

      const notification = notifRepo.create({
        userId: paymentRequest.userId,
        userEmail: paymentRequest.userEmail,
        type: NotificationType.PAYMENT_APPROVED,
        title: 'Payment Approved',
        message: `Your payment of ${Number(paymentRequest.amount).toLocaleString()} ${paymentRequest.currency} for ${paymentRequest.planName} has been approved. Your subscription is now active.`,
        data: {
          paymentRequestId: paymentRequest.id,
          subscriptionId: subscription.id,
          amount: Number(paymentRequest.amount),
          planName: paymentRequest.planName,
        },
      });
      await notifRepo.save(notification);

      return {
        paymentRequestId: paymentRequest.id,
        subscriptionId: subscription.id,
        status: 'APPROVED',
        message: `Payment approved. Subscription activated for ${paymentRequest.planName}.`,
      };
    });
  }

  async rejectPayment(
    paymentRequestId: string,
    admin: JwtPayload,
    rejectionReason: string,
  ) {
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new BadRequestException('Rejection reason is required');
    }

    return this.dataSource.transaction(async (manager) => {
      const prRepo = manager.getRepository(PaymentRequestEntity);
      const subRepo = manager.getRepository(SubscriptionEntity);
      const auditRepo = manager.getRepository(AuditLogEntity);
      const notifRepo = manager.getRepository(NotificationEntity);

      const paymentRequest = await prRepo.findOne({
        where: { id: paymentRequestId },
      });
      if (!paymentRequest) {
        throw new NotFoundException(
          `Payment request ${paymentRequestId} not found`,
        );
      }
      if (paymentRequest.status !== PaymentRequestStatus.PENDING) {
        throw new BadRequestException(
          `Payment request is already ${paymentRequest.status}`,
        );
      }

      paymentRequest.status = PaymentRequestStatus.REJECTED;
      paymentRequest.reviewedBy = admin.sub;
      paymentRequest.reviewedByEmail = admin.email;
      paymentRequest.reviewedAt = new Date();
      paymentRequest.rejectionReason = rejectionReason;
      await prRepo.save(paymentRequest);

      if (paymentRequest.subscriptionId) {
        await subRepo.update(
          { id: paymentRequest.subscriptionId },
          { status: SubscriptionStatus.REJECTED },
        );
      }

      const auditLog = auditRepo.create({
        action: AuditAction.PAYMENT_REJECTED,
        actorId: admin.sub,
        actorEmail: admin.email,
        actorRole: admin.role,
        targetId: paymentRequest.userId,
        targetEmail: paymentRequest.userEmail,
        targetType: 'payment_request',
        description: `Payment of ${Number(paymentRequest.amount).toLocaleString()} ${paymentRequest.currency} for ${paymentRequest.planName} rejected. Reason: ${rejectionReason}`,
        metadata: {
          paymentRequestId: paymentRequest.id,
          amount: Number(paymentRequest.amount),
          currency: paymentRequest.currency,
          planName: paymentRequest.planName,
          rejectionReason,
        },
      });
      await auditRepo.save(auditLog);

      const notification = notifRepo.create({
        userId: paymentRequest.userId,
        userEmail: paymentRequest.userEmail,
        type: NotificationType.PAYMENT_REJECTED,
        title: 'Payment Rejected',
        message: `Your payment of ${Number(paymentRequest.amount).toLocaleString()} ${paymentRequest.currency} for ${paymentRequest.planName} has been rejected. Reason: ${rejectionReason}`,
        data: {
          paymentRequestId: paymentRequest.id,
          amount: Number(paymentRequest.amount),
          planName: paymentRequest.planName,
          rejectionReason,
        },
      });
      await notifRepo.save(notification);

      return {
        paymentRequestId: paymentRequest.id,
        status: 'REJECTED',
        message: `Payment rejected. Reason: ${rejectionReason}`,
      };
    });
  }

  // ==================== SUBSCRIPTION MANAGEMENT ====================

  async listAllSubscriptions(query: {
    page?: number;
    limit?: number;
    status?: SubscriptionStatus;
    search?: string;
  }) {
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
    if (query.search) {
      qb.andWhere('sub.developer_name ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    const [rows, total] = await qb.skip(offset).take(limit).getManyAndCount();

    return {
      pagination: buildPaginationMeta(page, limit, total),
      data: rows.map((sub) => ({
        id: sub.id,
        developerName: sub.developerName,
        plan: {
          id: sub.plan.id,
          code: sub.plan.code,
          name: sub.plan.name,
          priceMonthlyRwf: Number(sub.plan.priceMonthlyRwf),
          rateLimitPerHour: sub.plan.rateLimitPerHour,
        },
        status: sub.status,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelledAt: sub.cancelledAt,
        createdAt: sub.createdAt,
      })),
    };
  }

  async approveSubscription(subscriptionId: string, admin: JwtPayload) {
    return this.dataSource.transaction(async (manager) => {
      const subRepo = manager.getRepository(SubscriptionEntity);
      const auditRepo = manager.getRepository(AuditLogEntity);

      const subscription = await subRepo.findOne({
        where: { id: subscriptionId },
        relations: { plan: true },
      });
      if (!subscription) {
        throw new NotFoundException(`Subscription ${subscriptionId} not found`);
      }
      if (subscription.status !== SubscriptionStatus.PENDING) {
        throw new BadRequestException(
          `Subscription is already ${subscription.status}`,
        );
      }

      const periodStart = new Date();
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.currentPeriodStart = periodStart;
      subscription.currentPeriodEnd = periodEnd;
      await subRepo.save(subscription);

      const auditLog = auditRepo.create({
        action: AuditAction.SUBSCRIPTION_ACTIVATED,
        actorId: admin.sub,
        actorEmail: admin.email,
        actorRole: admin.role,
        targetId: subscription.id,
        targetType: 'subscription',
        description: `Subscription for ${subscription.developerName} to ${subscription.plan.name} activated`,
        metadata: {
          subscriptionId: subscription.id,
          planName: subscription.plan.name,
          developerName: subscription.developerName,
        },
      });
      await auditRepo.save(auditLog);

      return {
        subscriptionId: subscription.id,
        status: 'ACTIVE',
        message: `Subscription for ${subscription.developerName} activated`,
      };
    });
  }

  async rejectSubscription(subscriptionId: string, admin: JwtPayload) {
    return this.dataSource.transaction(async (manager) => {
      const subRepo = manager.getRepository(SubscriptionEntity);
      const auditRepo = manager.getRepository(AuditLogEntity);

      const subscription = await subRepo.findOne({
        where: { id: subscriptionId },
        relations: { plan: true },
      });
      if (!subscription) {
        throw new NotFoundException(`Subscription ${subscriptionId} not found`);
      }
      if (subscription.status !== SubscriptionStatus.PENDING) {
        throw new BadRequestException(
          `Subscription is already ${subscription.status}`,
        );
      }

      subscription.status = SubscriptionStatus.REJECTED;
      await subRepo.save(subscription);

      const auditLog = auditRepo.create({
        action: AuditAction.SUBSCRIPTION_CANCELLED,
        actorId: admin.sub,
        actorEmail: admin.email,
        actorRole: admin.role,
        targetId: subscription.id,
        targetType: 'subscription',
        description: `Subscription for ${subscription.developerName} to ${subscription.plan.name} rejected`,
        metadata: {
          subscriptionId: subscription.id,
          planName: subscription.plan.name,
          developerName: subscription.developerName,
        },
      });
      await auditRepo.save(auditLog);

      return {
        subscriptionId: subscription.id,
        status: 'REJECTED',
        message: `Subscription for ${subscription.developerName} rejected`,
      };
    });
  }

  async cancelSubscription(subscriptionId: string, admin: JwtPayload) {
    return this.dataSource.transaction(async (manager) => {
      const subRepo = manager.getRepository(SubscriptionEntity);
      const auditRepo = manager.getRepository(AuditLogEntity);

      const subscription = await subRepo.findOne({
        where: { id: subscriptionId },
        relations: { plan: true },
      });
      if (!subscription) {
        throw new NotFoundException(`Subscription ${subscriptionId} not found`);
      }

      subscription.status = SubscriptionStatus.CANCELLED;
      subscription.cancelledAt = new Date();
      await subRepo.save(subscription);

      const auditLog = auditRepo.create({
        action: AuditAction.SUBSCRIPTION_CANCELLED,
        actorId: admin.sub,
        actorEmail: admin.email,
        actorRole: admin.role,
        targetId: subscription.id,
        targetType: 'subscription',
        description: `Subscription for ${subscription.developerName} to ${subscription.plan.name} cancelled by admin`,
        metadata: {
          subscriptionId: subscription.id,
          planName: subscription.plan.name,
          developerName: subscription.developerName,
        },
      });
      await auditRepo.save(auditLog);

      return {
        subscriptionId: subscription.id,
        status: 'CANCELLED',
        message: `Subscription for ${subscription.developerName} cancelled`,
      };
    });
  }

  async expireSubscription(subscriptionId: string, admin: JwtPayload) {
    return this.dataSource.transaction(async (manager) => {
      const subRepo = manager.getRepository(SubscriptionEntity);
      const auditRepo = manager.getRepository(AuditLogEntity);

      const subscription = await subRepo.findOne({
        where: { id: subscriptionId },
        relations: { plan: true },
      });
      if (!subscription) {
        throw new NotFoundException(`Subscription ${subscriptionId} not found`);
      }

      subscription.status = SubscriptionStatus.EXPIRED;
      await subRepo.save(subscription);

      const auditLog = auditRepo.create({
        action: AuditAction.SUBSCRIPTION_EXPIRED,
        actorId: admin.sub,
        actorEmail: admin.email,
        actorRole: admin.role,
        targetId: subscription.id,
        targetType: 'subscription',
        description: `Subscription for ${subscription.developerName} to ${subscription.plan.name} marked as expired`,
        metadata: {
          subscriptionId: subscription.id,
          planName: subscription.plan.name,
          developerName: subscription.developerName,
        },
      });
      await auditRepo.save(auditLog);

      return {
        subscriptionId: subscription.id,
        status: 'EXPIRED',
        message: `Subscription for ${subscription.developerName} marked as expired`,
      };
    });
  }

  async extendSubscription(
    subscriptionId: string,
    days: number,
    admin: JwtPayload,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const subRepo = manager.getRepository(SubscriptionEntity);
      const auditRepo = manager.getRepository(AuditLogEntity);

      const subscription = await subRepo.findOne({
        where: { id: subscriptionId },
        relations: { plan: true },
      });
      if (!subscription) {
        throw new NotFoundException(`Subscription ${subscriptionId} not found`);
      }

      const newEnd = new Date(subscription.currentPeriodEnd);
      newEnd.setDate(newEnd.getDate() + days);
      subscription.currentPeriodEnd = newEnd;
      if (subscription.status === SubscriptionStatus.EXPIRED) {
        subscription.status = SubscriptionStatus.ACTIVE;
      }
      await subRepo.save(subscription);

      const auditLog = auditRepo.create({
        action: AuditAction.SUBSCRIPTION_ACTIVATED,
        actorId: admin.sub,
        actorEmail: admin.email,
        actorRole: admin.role,
        targetId: subscription.id,
        targetType: 'subscription',
        description: `Subscription for ${subscription.developerName} extended by ${days} days`,
        metadata: {
          subscriptionId: subscription.id,
          planName: subscription.plan.name,
          developerName: subscription.developerName,
          daysExtended: days,
          newEndDate: newEnd.toISOString(),
        },
      });
      await auditRepo.save(auditLog);

      return {
        subscriptionId: subscription.id,
        status: subscription.status,
        newPeriodEnd: newEnd,
        message: `Subscription extended by ${days} days`,
      };
    });
  }

  async changeSubscriptionPlan(
    subscriptionId: string,
    planCode: string,
    admin: JwtPayload,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const subRepo = manager.getRepository(SubscriptionEntity);
      const planRepo = manager.getRepository(PlanEntity);
      const keyRepo = manager.getRepository(ApiKeyEntity);
      const auditRepo = manager.getRepository(AuditLogEntity);

      const subscription = await subRepo.findOne({
        where: { id: subscriptionId },
        relations: { plan: true },
      });
      if (!subscription) {
        throw new NotFoundException(`Subscription ${subscriptionId} not found`);
      }

      const newPlan = await planRepo.findOne({
        where: { code: planCode.toUpperCase(), isActive: true },
      });
      if (!newPlan) {
        throw new NotFoundException(`Plan ${planCode} not found`);
      }

      const oldPlanName = subscription.plan.name;
      subscription.plan = newPlan;
      await subRepo.save(subscription);

      await keyRepo.update(
        { developerName: subscription.developerName, isActive: true },
        { tier: newPlan.code as ApiKeyTier },
      );

      const auditLog = auditRepo.create({
        action: AuditAction.PLAN_UPDATED,
        actorId: admin.sub,
        actorEmail: admin.email,
        actorRole: admin.role,
        targetId: subscription.id,
        targetType: 'subscription',
        description: `Plan changed from ${oldPlanName} to ${newPlan.name} for ${subscription.developerName}`,
        metadata: {
          subscriptionId: subscription.id,
          oldPlan: oldPlanName,
          newPlan: newPlan.name,
          developerName: subscription.developerName,
        },
      });
      await auditRepo.save(auditLog);

      return {
        subscriptionId: subscription.id,
        plan: {
          code: newPlan.code,
          name: newPlan.name,
        },
        message: `Plan changed from ${oldPlanName} to ${newPlan.name}`,
      };
    });
  }

  // ==================== PLAN MANAGEMENT ====================

  async listAllPlansForAdmin() {
    const plans = await this.planRepo.find({
      order: { priceMonthlyRwf: 'ASC' },
    });
    return plans.map((plan) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      priceMonthlyRwf: Number(plan.priceMonthlyRwf),
      rateLimitPerHour: plan.rateLimitPerHour,
      features: plan.features,
      isActive: plan.isActive,
      createdAt: plan.createdAt,
    }));
  }

  async createPlan(
    data: {
      code: string;
      name: string;
      description?: string;
      priceMonthlyRwf: number;
      rateLimitPerHour?: number;
      features?: string[];
    },
    admin: JwtPayload,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const planRepo = manager.getRepository(PlanEntity);
      const auditRepo = manager.getRepository(AuditLogEntity);

      const existing = await planRepo.findOne({
        where: { code: data.code.toUpperCase() },
      });
      if (existing) {
        throw new BadRequestException(
          `Plan with code ${data.code} already exists`,
        );
      }

      const plan = planRepo.create({
        code: data.code.toUpperCase(),
        name: data.name,
        description: data.description ?? null,
        priceMonthlyRwf: data.priceMonthlyRwf,
        rateLimitPerHour: data.rateLimitPerHour ?? null,
        features: data.features ?? [],
        isActive: true,
      });
      const saved = await planRepo.save(plan);

      const auditLog = auditRepo.create({
        action: AuditAction.PLAN_CREATED,
        actorId: admin.sub,
        actorEmail: admin.email,
        actorRole: admin.role,
        targetId: saved.id,
        targetType: 'plan',
        description: `Plan ${saved.name} (${saved.code}) created at ${saved.priceMonthlyRwf} RWF/month`,
        metadata: {
          planId: saved.id,
          code: saved.code,
          name: saved.name,
          price: Number(saved.priceMonthlyRwf),
        },
      });
      await auditRepo.save(auditLog);

      return {
        id: saved.id,
        code: saved.code,
        name: saved.name,
        description: saved.description,
        priceMonthlyRwf: Number(saved.priceMonthlyRwf),
        rateLimitPerHour: saved.rateLimitPerHour,
        features: saved.features,
        isActive: saved.isActive,
        message: `Plan ${saved.name} created successfully`,
      };
    });
  }

  async updatePlan(
    planId: string,
    data: {
      name?: string;
      description?: string;
      priceMonthlyRwf?: number;
      rateLimitPerHour?: number;
      features?: string[];
      isActive?: boolean;
    },
    admin: JwtPayload,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const planRepo = manager.getRepository(PlanEntity);
      const auditRepo = manager.getRepository(AuditLogEntity);

      const plan = await planRepo.findOne({ where: { id: planId } });
      if (!plan) {
        throw new NotFoundException(`Plan ${planId} not found`);
      }

      const changes: string[] = [];
      if (data.name !== undefined) {
        changes.push(`name: ${plan.name} → ${data.name}`);
        plan.name = data.name;
      }
      if (data.description !== undefined) {
        changes.push('description updated');
        plan.description = data.description;
      }
      if (data.priceMonthlyRwf !== undefined) {
        changes.push(
          `price: ${plan.priceMonthlyRwf} → ${data.priceMonthlyRwf}`,
        );
        plan.priceMonthlyRwf = data.priceMonthlyRwf;
      }
      if (data.rateLimitPerHour !== undefined) {
        changes.push(
          `rate limit: ${plan.rateLimitPerHour} → ${data.rateLimitPerHour}`,
        );
        plan.rateLimitPerHour = data.rateLimitPerHour;
      }
      if (data.features !== undefined) {
        changes.push('features updated');
        plan.features = data.features;
      }
      if (data.isActive !== undefined) {
        changes.push(`active: ${plan.isActive} → ${data.isActive}`);
        plan.isActive = data.isActive;
      }

      await planRepo.save(plan);

      const auditLog = auditRepo.create({
        action: AuditAction.PLAN_UPDATED,
        actorId: admin.sub,
        actorEmail: admin.email,
        actorRole: admin.role,
        targetId: plan.id,
        targetType: 'plan',
        description: `Plan ${plan.name} updated: ${changes.join(', ')}`,
        metadata: {
          planId: plan.id,
          code: plan.code,
          changes,
        },
      });
      await auditRepo.save(auditLog);

      return {
        id: plan.id,
        code: plan.code,
        name: plan.name,
        description: plan.description,
        priceMonthlyRwf: Number(plan.priceMonthlyRwf),
        rateLimitPerHour: plan.rateLimitPerHour,
        features: plan.features,
        isActive: plan.isActive,
        message: `Plan ${plan.name} updated successfully`,
      };
    });
  }

  async deletePlan(planId: string, admin: JwtPayload) {
    return this.dataSource.transaction(async (manager) => {
      const planRepo = manager.getRepository(PlanEntity);
      const auditRepo = manager.getRepository(AuditLogEntity);

      const plan = await planRepo.findOne({ where: { id: planId } });
      if (!plan) {
        throw new NotFoundException(`Plan ${planId} not found`);
      }

      await planRepo.remove(plan);

      const auditLog = auditRepo.create({
        action: AuditAction.PLAN_DELETED,
        actorId: admin.sub,
        actorEmail: admin.email,
        actorRole: admin.role,
        targetId: planId,
        targetType: 'plan',
        description: `Plan ${plan.name} (${plan.code}) deleted`,
        metadata: {
          planId,
          code: plan.code,
          name: plan.name,
        },
      });
      await auditRepo.save(auditLog);

      return {
        message: `Plan ${plan.name} deleted successfully`,
      };
    });
  }

  // ==================== USER MANAGEMENT ====================

  async listAllUsers(query: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = paginateOffset(page, limit);

    const qb = this.memberRepo
      .createQueryBuilder('member')
      .leftJoinAndSelect('member.organization', 'org')
      .orderBy('member.created_at', 'DESC');

    if (query.search) {
      qb.andWhere(
        '(member.email ILIKE :search OR org.name ILIKE :search OR org.slug ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.role) {
      qb.andWhere('member.role = :role', { role: query.role });
    }

    const [members, total] = await qb
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    const data = await Promise.all(
      members.map(async (member) => {
        const apiKeys = await this.apiKeyRepo.find({
          where: { developerName: member.organization.slug },
        });
        const subscription = await this.subscriptionRepo.findOne({
          where: {
            developerName: member.organization.slug,
            status: SubscriptionStatus.ACTIVE,
          },
          relations: { plan: true },
          order: { createdAt: 'DESC' },
        });

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
          currentPlan: subscription
            ? {
                id: subscription.plan.id,
                code: subscription.plan.code,
                name: subscription.plan.name,
                status: subscription.status,
              }
            : null,
          apiKeyCount: apiKeys.length,
          activeApiKeys: apiKeys.filter((k) => k.isActive).length,
          createdAt: member.createdAt,
        };
      }),
    );

    return {
      pagination: buildPaginationMeta(page, limit, total),
      data,
    };
  }

  async getUserDetails(userId: string) {
    const member = await this.memberRepo.findOne({
      where: { id: userId },
      relations: { organization: true },
    });
    if (!member) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const apiKeys = await this.apiKeyRepo.find({
      where: { developerName: member.organization.slug },
      order: { createdAt: 'DESC' },
    });

    const subscriptions = await this.subscriptionRepo.find({
      where: { developerName: member.organization.slug },
      relations: { plan: true },
      order: { createdAt: 'DESC' },
    });

    const paymentRequests = await this.paymentRequestRepo.find({
      where: { userId: member.id },
      order: { createdAt: 'DESC' },
    });

    const notifications = await this.notificationRepo.find({
      where: { userId: member.id },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    return {
      user: {
        id: member.id,
        email: member.email,
        role: member.role,
        emailVerified: member.emailVerified,
        organization: {
          id: member.organization.id,
          name: member.organization.name,
          slug: member.organization.slug,
        },
        createdAt: member.createdAt,
      },
      apiKeys: apiKeys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        environment: k.environment,
        tier: k.tier,
        isActive: k.isActive,
        lastUsedAt: k.lastUsedAt,
        createdAt: k.createdAt,
      })),
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        plan: {
          code: s.plan.code,
          name: s.plan.name,
          priceMonthlyRwf: Number(s.plan.priceMonthlyRwf),
        },
        status: s.status,
        currentPeriodStart: s.currentPeriodStart,
        currentPeriodEnd: s.currentPeriodEnd,
        createdAt: s.createdAt,
      })),
      paymentRequests: paymentRequests.map((pr) => ({
        id: pr.id,
        planName: pr.planName,
        amount: Number(pr.amount),
        currency: pr.currency,
        status: pr.status,
        createdAt: pr.createdAt,
      })),
      recentNotifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        read: n.read,
        createdAt: n.createdAt,
      })),
    };
  }

  async suspendUser(userId: string, admin: JwtPayload, reason?: string) {
    return this.dataSource.transaction(async (manager) => {
      const memberRepo = manager.getRepository(OrganizationMemberEntity);
      const keyRepo = manager.getRepository(ApiKeyEntity);
      const auditRepo = manager.getRepository(AuditLogEntity);

      const member = await memberRepo.findOne({
        where: { id: userId },
        relations: { organization: true },
      });
      if (!member) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      await keyRepo.update(
        { developerName: member.organization.slug },
        { isActive: false, revokedAt: new Date() },
      );

      const auditLog = auditRepo.create({
        action: AuditAction.USER_SUSPENDED,
        actorId: admin.sub,
        actorEmail: admin.email,
        actorRole: admin.role,
        targetId: member.id,
        targetEmail: member.email,
        targetType: 'user',
        description: `User ${member.email} suspended. Reason: ${reason ?? 'Administrative action'}`,
        metadata: {
          userId: member.id,
          email: member.email,
          organizationSlug: member.organization.slug,
          reason: reason ?? null,
        },
      });
      await auditRepo.save(auditLog);

      return {
        userId: member.id,
        email: member.email,
        message: `User ${member.email} suspended and API keys revoked`,
      };
    });
  }

  async activateUser(userId: string, admin: JwtPayload) {
    return this.dataSource.transaction(async (manager) => {
      const memberRepo = manager.getRepository(OrganizationMemberEntity);
      const auditRepo = manager.getRepository(AuditLogEntity);

      const member = await memberRepo.findOne({
        where: { id: userId },
        relations: { organization: true },
      });
      if (!member) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      const auditLog = auditRepo.create({
        action: AuditAction.USER_ACTIVATED,
        actorId: admin.sub,
        actorEmail: admin.email,
        actorRole: admin.role,
        targetId: member.id,
        targetEmail: member.email,
        targetType: 'user',
        description: `User ${member.email} reactivated`,
        metadata: {
          userId: member.id,
          email: member.email,
        },
      });
      await auditRepo.save(auditLog);

      return {
        userId: member.id,
        email: member.email,
        message: `User ${member.email} reactivated`,
      };
    });
  }

  async changeUserRole(userId: string, newRole: string, admin: JwtPayload) {
    return this.dataSource.transaction(async (manager) => {
      const memberRepo = manager.getRepository(OrganizationMemberEntity);
      const auditRepo = manager.getRepository(AuditLogEntity);

      const member = await memberRepo.findOne({ where: { id: userId } });
      if (!member) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      const oldRole = member.role;
      member.role = newRole as OrganizationRole;
      await memberRepo.save(member);

      const auditLog = auditRepo.create({
        action: AuditAction.USER_ROLE_CHANGED,
        actorId: admin.sub,
        actorEmail: admin.email,
        actorRole: admin.role,
        targetId: member.id,
        targetEmail: member.email,
        targetType: 'user',
        description: `Role changed from ${oldRole} to ${newRole} for ${member.email}`,
        metadata: {
          userId: member.id,
          email: member.email,
          oldRole,
          newRole,
        },
      });
      await auditRepo.save(auditLog);

      return {
        userId: member.id,
        email: member.email,
        oldRole,
        newRole,
        message: `Role changed from ${oldRole} to ${newRole}`,
      };
    });
  }

  async deleteUser(userId: string, admin: JwtPayload) {
    return this.dataSource.transaction(async (manager) => {
      const memberRepo = manager.getRepository(OrganizationMemberEntity);
      const keyRepo = manager.getRepository(ApiKeyEntity);
      const auditRepo = manager.getRepository(AuditLogEntity);

      const member = await memberRepo.findOne({
        where: { id: userId },
        relations: { organization: true },
      });
      if (!member) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      await keyRepo.update(
        { developerName: member.organization.slug },
        { isActive: false, revokedAt: new Date() },
      );

      const email = member.email;
      const orgSlug = member.organization.slug;
      await memberRepo.remove(member);

      const auditLog = auditRepo.create({
        action: AuditAction.USER_DELETED,
        actorId: admin.sub,
        actorEmail: admin.email,
        actorRole: admin.role,
        targetEmail: email,
        targetType: 'user',
        description: `User ${email} deleted`,
        metadata: {
          email,
          organizationSlug: orgSlug,
        },
      });
      await auditRepo.save(auditLog);

      return {
        message: `User ${email} deleted successfully`,
      };
    });
  }

  // ==================== AUDIT LOGS ====================

  async listAuditLogs(query: {
    page?: number;
    limit?: number;
    action?: AuditAction;
    actorEmail?: string;
    targetEmail?: string;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const offset = paginateOffset(page, limit);

    const qb = this.auditLogRepo
      .createQueryBuilder('log')
      .orderBy('log.created_at', 'DESC');

    if (query.action) {
      qb.andWhere('log.action = :action', { action: query.action });
    }
    if (query.actorEmail) {
      qb.andWhere('log.actor_email ILIKE :actorEmail', {
        actorEmail: `%${query.actorEmail}%`,
      });
    }
    if (query.targetEmail) {
      qb.andWhere('log.target_email ILIKE :targetEmail', {
        targetEmail: `%${query.targetEmail}%`,
      });
    }

    const [rows, total] = await qb.skip(offset).take(limit).getManyAndCount();

    return {
      pagination: buildPaginationMeta(page, limit, total),
      data: rows.map((log) => ({
        id: log.id,
        action: log.action,
        actorId: log.actorId,
        actorEmail: log.actorEmail,
        actorRole: log.actorRole,
        targetId: log.targetId,
        targetEmail: log.targetEmail,
        targetType: log.targetType,
        description: log.description,
        metadata: log.metadata,
        createdAt: log.createdAt,
      })),
    };
  }

  // ==================== NOTIFICATIONS ====================

  async listNotifications(
    userId: string,
    query: { page?: number; limit?: number; unreadOnly?: boolean },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = paginateOffset(page, limit);

    const qb = this.notificationRepo
      .createQueryBuilder('notif')
      .where('notif.user_id = :userId', { userId })
      .orderBy('notif.created_at', 'DESC');

    if (query.unreadOnly) {
      qb.andWhere('notif.read = :read', { read: false });
    }

    const [rows, total] = await qb.skip(offset).take(limit).getManyAndCount();

    return {
      pagination: buildPaginationMeta(page, limit, total),
      data: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        data: n.data,
        read: n.read,
        createdAt: n.createdAt,
      })),
    };
  }

  async markNotificationRead(notificationId: string, userId: string) {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId, userId },
    });
    if (!notification) {
      throw new NotFoundException(`Notification ${notificationId} not found`);
    }

    notification.read = true;
    notification.readAt = new Date();
    await this.notificationRepo.save(notification);

    return { message: 'Notification marked as read' };
  }

  async getUnreadNotificationCount(userId: string) {
    const count = await this.notificationRepo.count({
      where: { userId, read: false },
    });
    return { count };
  }
}
