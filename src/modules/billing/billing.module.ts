import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingAdminController } from './billing-admin.controller';
import { BillingAdminService } from './billing-admin.service';
import { BillingCronService } from './billing-cron.service';
import { BillingMailService } from './billing-mail.service';
import { PlanEntity } from './entities/plan.entity';
import { SubscriptionEntity } from './entities/subscription.entity';
import { InvoiceEntity } from './entities/invoice.entity';
import { PaymentRequestEntity } from './entities/payment-request.entity';
import { AuditLogEntity } from './entities/audit-log.entity';
import { NotificationEntity } from './entities/notification.entity';
import { ApiKeyEntity } from '../auth/entities/api-key.entity';
import { OrganizationMemberEntity } from '../organizations/entities/organization-member.entity';
import { OrganizationEntity } from '../organizations/entities/organization.entity';
import { MailModule } from '../../common/mail/mail.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      PlanEntity,
      SubscriptionEntity,
      InvoiceEntity,
      PaymentRequestEntity,
      AuditLogEntity,
      NotificationEntity,
      ApiKeyEntity,
      OrganizationMemberEntity,
      OrganizationEntity,
    ]),
    MailModule,
  ],
  controllers: [BillingController, BillingAdminController],
  providers: [
    BillingService,
    BillingAdminService,
    BillingCronService,
    BillingMailService,
  ],
  exports: [
    BillingService,
    BillingAdminService,
    BillingCronService,
    BillingMailService,
  ],
})
export class BillingModule {}
