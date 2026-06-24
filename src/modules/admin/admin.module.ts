import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ApiKeyEntity } from '../auth/entities/api-key.entity';
import { ApiLogEntity } from '../analytics/entities/api-log.entity';
import { ApiUsageEntity } from '../analytics/entities/api-usage.entity';
import { SubscriptionEntity } from '../billing/entities/subscription.entity';
import { InvoiceEntity } from '../billing/entities/invoice.entity';
import { PlanEntity } from '../billing/entities/plan.entity';
import { OrganizationMemberEntity } from '../organizations/entities/organization-member.entity';
import { OrganizationEntity } from '../organizations/entities/organization.entity';
import { WebhookDeliveryEntity } from '../webhooks/entities/webhook-delivery.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApiKeyEntity,
      ApiLogEntity,
      ApiUsageEntity,
      SubscriptionEntity,
      InvoiceEntity,
      PlanEntity,
      OrganizationMemberEntity,
      OrganizationEntity,
      WebhookDeliveryEntity,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
