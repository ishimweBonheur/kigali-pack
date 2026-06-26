import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '@nestjs/config';

import { HttpModule } from '@nestjs/axios';

import { JwtModule } from '@nestjs/jwt';

import { BullModule } from '@nestjs/bullmq';

import { MailModule } from './common/mail/mail.module';

import { ApiKeyEntity } from './modules/auth/entities/api-key.entity';

import { RefreshTokenEntity } from './modules/auth/entities/refresh-token.entity';

import { AuthActionTokenEntity } from './modules/auth/entities/auth-action-token.entity';

import { ApiLogEntity } from './modules/analytics/entities/api-log.entity';

import { ApiUsageEntity } from './modules/analytics/entities/api-usage.entity';

import { AdministrativeUnitEntity } from './modules/locations/entities/administrative-unit.entity';

import { MockTransactionEntity } from './modules/sandbox/entities/mock-transaction.entity';

import { WebhookEntity } from './modules/webhooks/entities/webhook.entity';

import { WebhookDeliveryEntity } from './modules/webhooks/entities/webhook-delivery.entity';

import { PlanEntity } from './modules/billing/entities/plan.entity';

import { SubscriptionEntity } from './modules/billing/entities/subscription.entity';

import { InvoiceEntity } from './modules/billing/entities/invoice.entity';

import { OrganizationEntity } from './modules/organizations/entities/organization.entity';

import { OrganizationMemberEntity } from './modules/organizations/entities/organization-member.entity';

import { HealthController } from './modules/health/health.controller';

import { LocationsController } from './modules/locations/locations.controller';

import { SandboxController } from './modules/sandbox/sandbox.controller';

import { KycController } from './modules/kyc/kyc.controller';

import { MasterCoreSnapshotController } from './modules/auth/master-core-snapshot.controller';

import { ApiKeyController } from './modules/auth/api-key.controller';

import { AuthController } from './modules/auth/auth.controller';

import { AnalyticsController } from './modules/analytics/analytics.controller';

import { WebhookController } from './modules/webhooks/webhook.controller';

import { BillingController } from './modules/billing/billing.controller';

import { OrganizationController } from './modules/organizations/organization.controller';

import { MeController } from './modules/me/me.controller';

import { PhoneController } from './modules/utilities/phone.controller';

import { TestDataController } from './modules/utilities/test-data.controller';

import { ApiKeyService } from './modules/auth/api-key.service';

import { AuthService } from './modules/auth/auth.service';

import { ApiKeyGuard } from './common/guards/api-key.guard';

import { TierThrottlerGuard } from './common/guards/tier-throttler.guard';

import { JwtAuthGuard, RolesGuard } from './common/guards/jwt-auth.guard';

import { RedisModule } from './common/redis/redis.module';

import { RateLimitService } from './common/rate-limit/rate-limit.service';

import { UsageMeteringService } from './modules/analytics/usage-metering.service';

import { AnalyticsService } from './modules/analytics/analytics.service';

import { SandboxHistoryService } from './modules/sandbox/sandbox-history.service';

import {
  WebhookService,
  WEBHOOK_DELIVERY_QUEUE,
  WEBHOOK_DLQ,
} from './modules/webhooks/webhook.service';

import { WebhookDeliveryProcessor } from './modules/webhooks/webhook-delivery.processor';

import { BillingService } from './modules/billing/billing.service';

import { OrganizationService } from './modules/organizations/organization.service';

import { MeService } from './modules/me/me.service';

import { PhoneService } from './modules/utilities/phone.service';

import { TestDataService } from './modules/utilities/test-data.service';

import { HealthService } from './modules/health/health.service';

import { CacheService } from './common/cache/cache.service';

import { LocationsCacheInterceptor } from './common/cache/locations-cache.interceptor';

import { LocationsService } from './modules/locations/locations.service';

import { RraPayrollService } from './modules/kyc/rra-payroll.service';

import { AuditLogService } from './common/audit/audit-log.service';

import { AuditLogInterceptor } from './common/audit/audit-log.interceptor';

import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { TelemetryInterceptor } from './common/interceptors/telemetry.interceptor';

import { DeprecationHeaderInterceptor } from './common/interceptors/deprecation-header.interceptor';

import { AdminGuard } from './common/guards/admin.guard';

import { InternalGuard } from './common/guards/internal.guard';

import { AuthRateLimitGuard } from './common/guards/auth-rate-limit.guard';

import { AdminModule } from './modules/admin/admin.module';

const ENTITIES = [
  ApiKeyEntity,

  RefreshTokenEntity,

  AuthActionTokenEntity,

  ApiLogEntity,

  ApiUsageEntity,

  AdministrativeUnitEntity,

  MockTransactionEntity,

  WebhookEntity,

  WebhookDeliveryEntity,

  PlanEntity,

  SubscriptionEntity,

  InvoiceEntity,

  OrganizationEntity,

  OrganizationMemberEntity,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    MailModule,

    RedisModule,

    JwtModule.register({
      global: true,

      secret:
        process.env.JWT_SECRET || 'kigali-pack-dev-secret-change-in-production',

      signOptions: { expiresIn: '15m' },
    }),

    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',

        port: parseInt(process.env.REDIS_PORT || '6379', 10),

        password: process.env.REDIS_PASSWORD || undefined,

        db: parseInt(process.env.REDIS_DB || '0', 10),
      },
    }),

    BullModule.registerQueue(
      { name: WEBHOOK_DELIVERY_QUEUE },

      { name: WEBHOOK_DLQ },
    ),

    TypeOrmModule.forRoot({
      type: 'postgres',

      host: process.env.DB_HOST || 'localhost',

      port: parseInt(process.env.DB_PORT || '5432', 10),

      username: process.env.DB_USERNAME || 'postgres',

      password: process.env.DB_PASSWORD || 'postgres',

      database: process.env.DB_NAME || 'kigalipack_db',

      entities: ENTITIES,

      synchronize: false,

      logging: process.env.NODE_ENV === 'development',
    }),

    TypeOrmModule.forFeature(ENTITIES),

    AdminModule,

    HttpModule,
  ],

  controllers: [
    HealthController,

    AuthController,

    MeController,

    LocationsController,

    SandboxController,

    KycController,

    MasterCoreSnapshotController,

    ApiKeyController,

    AnalyticsController,

    WebhookController,

    BillingController,

    OrganizationController,

    PhoneController,

    TestDataController,
  ],

  providers: [
    ApiKeyService,

    AuthService,

    ApiKeyGuard,

    RateLimitService,

    TierThrottlerGuard,

    UsageMeteringService,

    AnalyticsService,

    SandboxHistoryService,

    WebhookService,

    WebhookDeliveryProcessor,

    BillingService,

    OrganizationService,

    MeService,

    JwtAuthGuard,

    RolesGuard,

    PhoneService,

    TestDataService,

    HealthService,

    CacheService,

    LocationsCacheInterceptor,

    LocationsService,

    RraPayrollService,

    AuditLogService,

    AuditLogInterceptor,

    RequestLoggingInterceptor,

    TelemetryInterceptor,

    DeprecationHeaderInterceptor,

    AdminGuard,

    InternalGuard,

    AuthRateLimitGuard,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
