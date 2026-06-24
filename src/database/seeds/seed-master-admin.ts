import * as crypto from 'crypto';
import { AppDataSource } from '../data-source';
import {
  OrganizationMemberEntity,
  OrganizationRole,
} from '../../modules/organizations/entities/organization-member.entity';
import { OrganizationEntity } from '../../modules/organizations/entities/organization.entity';
import { PlanEntity } from '../../modules/billing/entities/plan.entity';
import {
  SubscriptionEntity,
  SubscriptionStatus,
} from '../../modules/billing/entities/subscription.entity';

const DEFAULT_EMAIL = 'admin@kigalipack.rw';
const DEFAULT_PASSWORD = 'KigaliPack!Admin2026';
const PLATFORM_ORG_SLUG = 'kigalipack-platform';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function seedMasterAdmin() {
  await AppDataSource.initialize();

  const email = (process.env.MASTER_ADMIN_EMAIL ?? DEFAULT_EMAIL).toLowerCase();
  const password = process.env.MASTER_ADMIN_PASSWORD ?? DEFAULT_PASSWORD;

  const memberRepo = AppDataSource.getRepository(OrganizationMemberEntity);
  const orgRepo = AppDataSource.getRepository(OrganizationEntity);
  const planRepo = AppDataSource.getRepository(PlanEntity);
  const subRepo = AppDataSource.getRepository(SubscriptionEntity);

  let org = await orgRepo.findOne({ where: { slug: PLATFORM_ORG_SLUG } });
  if (!org) {
    org = orgRepo.create({
      name: 'Kigali-Pack Platform',
      slug: PLATFORM_ORG_SLUG,
    });
    org = await orgRepo.save(org);
    console.log(`  Created platform organization (${PLATFORM_ORG_SLUG}).`);
  }

  let member = await memberRepo.findOne({ where: { email } });
  if (member) {
    member.role = OrganizationRole.MASTER_ADMIN;
    member.passwordHash = hashPassword(password);
    member.emailVerified = true;
    await memberRepo.save(member);
    console.log(`  Updated existing master admin: ${email}`);
  } else {
    member = memberRepo.create({
      organization: org,
      email,
      passwordHash: hashPassword(password),
      role: OrganizationRole.MASTER_ADMIN,
      emailVerified: true,
    });
    await memberRepo.save(member);
    console.log(`  Created master admin: ${email}`);
  }

  const enterprisePlan = await planRepo.findOne({
    where: { code: 'ENTERPRISE' },
  });
  if (enterprisePlan) {
    const existingSub = await subRepo.findOne({
      where: { developerName: PLATFORM_ORG_SLUG },
    });
    if (!existingSub) {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      await subRepo.save(
        subRepo.create({
          developerName: PLATFORM_ORG_SLUG,
          plan: enterprisePlan,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        }),
      );
      console.log('  Enterprise subscription attached to platform org.');
    }
  }

  console.log('\nMaster admin credentials:');
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log('\nSign in at /login then open /admin-dashboard');

  await AppDataSource.destroy();
}

seedMasterAdmin().catch((error) => {
  console.error('Master admin seed failed:', error);
  process.exit(1);
});
