import { AppDataSource } from '../data-source';

const PLANS = [
  {
    code: 'FREE',
    name: 'Free',
    description:
      'For hobbyists and prototypes — basic API access with limited requests',
    price_monthly_rwf: 0,
    rate_limit_per_hour: 100,
    features: JSON.stringify([
      '100 requests/hour',
      '5 API keys',
      'Sandbox payments',
      'Location API',
      'Basic support',
      '1 webhook',
    ]),
  },
  {
    code: 'DEVELOPER',
    name: 'Developer',
    description: 'For individual developers building production applications',
    price_monthly_rwf: 29000,
    rate_limit_per_hour: 1000,
    features: JSON.stringify([
      '1,000 requests/hour',
      '20 API keys',
      'Sandbox payments',
      'Location API',
      'Webhook engine',
      'Analytics dashboard',
      'Email support',
    ]),
  },
  {
    code: 'PRO',
    name: 'Professional',
    description: 'For growing businesses that need reliable API infrastructure',
    price_monthly_rwf: 99000,
    rate_limit_per_hour: 10000,
    features: JSON.stringify([
      '10,000 requests/hour',
      'Unlimited API keys',
      'Sandbox payments',
      'Location API',
      'Webhook engine',
      'Analytics dashboard',
      'Priority support',
      'Custom webhooks',
      'API usage monitoring',
    ]),
  },
  {
    code: 'BUSINESS',
    name: 'Business',
    description: 'For organizations with high-volume API consumption',
    price_monthly_rwf: 199000,
    rate_limit_per_hour: 25000,
    features: JSON.stringify([
      '25,000 requests/hour',
      'Unlimited API keys',
      'Sandbox payments',
      'Location API',
      'Webhook engine',
      'Advanced analytics',
      'Priority support',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantee',
    ]),
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'Unlimited scale with custom SLA and dedicated infrastructure',
    price_monthly_rwf: 499000,
    rate_limit_per_hour: null,
    features: JSON.stringify([
      'Unlimited requests',
      'Unlimited API keys',
      'All features included',
      'Dedicated support',
      'Custom integrations',
      'On-premise deployment option',
      'White-label option',
      '99.99% SLA',
      'MTN MoMo billing ready',
      'Flutterwave & Paystack ready',
    ]),
  },
];

async function seedBillingPlans() {
  await AppDataSource.initialize();
  console.log('Seeding billing plans...\n');

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
        features = EXCLUDED.features,
        is_active = true
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
    console.log(
      `  ✓ ${plan.code} — ${plan.name} (${plan.price_monthly_rwf.toLocaleString()} RWF/month)`,
    );
  }

  console.log('\nBilling plans seeded successfully.');
  await AppDataSource.destroy();
}

seedBillingPlans().catch((error) => {
  console.error('Billing seed failed:', error);
  process.exit(1);
});
