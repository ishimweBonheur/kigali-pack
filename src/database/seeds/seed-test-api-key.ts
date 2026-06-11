import { AppDataSource } from '../data-source';
import * as crypto from 'crypto';

const TEST_KEY = 'kp_test_your_secret_token_here';

async function seed() {
  await AppDataSource.initialize();

  const hashedKey = crypto.createHash('sha256').update(TEST_KEY).digest('hex');

  await AppDataSource.query(
    `INSERT INTO developer_api_keys (
       developer_name, hashed_key, key_prefix, environment, tier, is_active
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (hashed_key) DO UPDATE
       SET developer_name = EXCLUDED.developer_name,
           key_prefix = EXCLUDED.key_prefix,
           environment = EXCLUDED.environment,
           tier = EXCLUDED.tier,
           is_active = true,
           revoked_at = NULL`,
    ['Test Developer', hashedKey, 'kp_test_your_se', 'TEST', 'FREE', true],
  );

  console.log('Seed complete. Use this key in Swagger:');
  console.log(`  Bearer ${TEST_KEY}`);

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
