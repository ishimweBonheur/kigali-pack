import { AppDataSource } from '../data-source';

const PLANS = [
  {
    code: 'FREE',
    name: 'Free',
    description: 'For hobbyists and prototypes',
    price_monthly_rwf: 0,
    rate_limit_per_hour: 100,
    features: JSON.stringify([
      '100 requests/hour',
      'Sandbox payments',
      'Location API',
    ]),
  },
  {
    code: 'PRO',
    name: 'Professional',
    description: 'For production applications',
    price_monthly_rwf: 50000,
    rate_limit_per_hour: 10000,
    features: JSON.stringify([
      '10,000 requests/hour',
      'Webhook engine',
      'Analytics dashboard',
      'Priority support',
    ]),
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'Unlimited scale with custom SLA',
    price_monthly_rwf: 500000,
    rate_limit_per_hour: null,
    features: JSON.stringify([
      'Unlimited requests',
      'Dedicated support',
      'Custom integrations',
      'MTN MoMo billing ready',
    ]),
  },
];

async function seedBillingPlans() {
  await AppDataSource.initialize();
  console.log('Seeding billing plans...');

  for (const plan of PLANS) {
    await AppDataSource.query(
      `
      INSERT INTO billing_plans (id, code, name, description, price_monthly_rwf, rate_limit_per_hour, features, is_active)
      VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6::jsonb, true)
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        price_monthly_rwf = EXCLUDED.price_monthly_rwf,
        rate_limit_per_hour = EXCLUDED.rate_limit_per_hour,
        features = EXCLUDED.features
      `,
      [
        plan.code,
        plan.name,
        plan.description,
        plan.price_monthly_rwf,
        plan.rate_limit_per_hour,
        plan.features,
      ],
    );
    console.log(`  ✓ Plan ${plan.code}`);
  }

  await AppDataSource.destroy();
  console.log('Billing plans seeded.');
}

seedBillingPlans().catch((error) => {
  console.error('Billing seed failed:', error);
  process.exit(1);
});
