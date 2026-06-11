import { AppDataSource } from '../data-source';
import * as crypto from 'crypto';

const TEST_KEY = 'kp_test_your_secret_token_here';
const PRO_TEST_KEY = 'kp_test_pro_tier_secret_token';

interface LocationSeedNode {
  name: string;
  code: string;
  level: 'PROVINCE' | 'DISTRICT' | 'SECTOR' | 'CELL' | 'VILLAGE';
  children?: LocationSeedNode[];
}

const RWANDA_LOCATION_GRAPH: LocationSeedNode[] = [
  {
    name: 'Kigali City',
    code: 'RW-PROV-KIGALI',
    level: 'PROVINCE',
    children: [
      {
        name: 'Gasabo',
        code: 'RW-DIST-GASABO',
        level: 'DISTRICT',
        children: [
          {
            name: 'Remera',
            code: 'RW-SEC-REMERA',
            level: 'SECTOR',
            children: [
              {
                name: 'Rukiri I',
                code: 'RW-CELL-RUKIRI1',
                level: 'CELL',
                children: [
                  { name: 'Amahoro', code: 'RW-VIL-AMAHORO', level: 'VILLAGE' },
                  { name: 'Ubumwe', code: 'RW-VIL-UBUMWE', level: 'VILLAGE' },
                ],
              },
            ],
          },
        ],
      },
      {
        name: 'Kicukiro',
        code: 'RW-DIST-KICUKIRO',
        level: 'DISTRICT',
        children: [
          {
            name: 'Gikondo',
            code: 'RW-SEC-GIKONDO',
            level: 'SECTOR',
            children: [
              {
                name: 'Kabeza',
                code: 'RW-CELL-KABEZA',
                level: 'CELL',
                children: [
                  { name: 'Gikondo I', code: 'RW-VIL-GIKONDO1', level: 'VILLAGE' },
                ],
              },
            ],
          },
        ],
      },
      {
        name: 'Nyarugenge',
        code: 'RW-DIST-NYARUGENGE',
        level: 'DISTRICT',
        children: [
          {
            name: 'Nyamirambo',
            code: 'RW-SEC-NYAMIRAMBO',
            level: 'SECTOR',
            children: [
              {
                name: 'Biryogo',
                code: 'RW-CELL-BIRYOGO',
                level: 'CELL',
                children: [
                  { name: 'Biryogo I', code: 'RW-VIL-BIRYOGO1', level: 'VILLAGE' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Eastern Province',
    code: 'RW-PROV-EASTERN',
    level: 'PROVINCE',
    children: [
      {
        name: 'Rwamagana',
        code: 'RW-DIST-RWAMAGANA',
        level: 'DISTRICT',
        children: [
          {
            name: 'Muyumbu',
            code: 'RW-SEC-MUYUMBU',
            level: 'SECTOR',
            children: [
              {
                name: 'Kigabiro',
                code: 'RW-CELL-KIGABIRO',
                level: 'CELL',
                children: [
                  { name: 'Kigabiro I', code: 'RW-VIL-KIGABIRO1', level: 'VILLAGE' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Northern Province',
    code: 'RW-PROV-NORTHERN',
    level: 'PROVINCE',
    children: [
      {
        name: 'Musanze',
        code: 'RW-DIST-MUSANZE',
        level: 'DISTRICT',
        children: [
          {
            name: 'Muhoza',
            code: 'RW-SEC-MUHOZA',
            level: 'SECTOR',
            children: [
              {
                name: 'Cyuve',
                code: 'RW-CELL-CYUVE',
                level: 'CELL',
                children: [
                  { name: 'Cyuve I', code: 'RW-VIL-CYUVE1', level: 'VILLAGE' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Southern Province',
    code: 'RW-PROV-SOUTHERN',
    level: 'PROVINCE',
    children: [
      {
        name: 'Huye',
        code: 'RW-DIST-HUYE',
        level: 'DISTRICT',
        children: [
          {
            name: 'Ngoma',
            code: 'RW-SEC-NGOMA',
            level: 'SECTOR',
            children: [
              {
                name: 'Matyazo',
                code: 'RW-CELL-MATYAZO',
                level: 'CELL',
                children: [
                  { name: 'Matyazo I', code: 'RW-VIL-MATYAZO1', level: 'VILLAGE' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Western Province',
    code: 'RW-PROV-WESTERN',
    level: 'PROVINCE',
    children: [
      {
        name: 'Rubavu',
        code: 'RW-DIST-RUBAVU',
        level: 'DISTRICT',
        children: [
          {
            name: 'Gisenyi',
            code: 'RW-SEC-GISENYI',
            level: 'SECTOR',
            children: [
              {
                name: 'Nyamyumba',
                code: 'RW-CELL-NYAMYUMBA',
                level: 'CELL',
                children: [
                  { name: 'Nyamyumba I', code: 'RW-VIL-NYAMYUMBA1', level: 'VILLAGE' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

async function upsertApiKey(
  developerName: string,
  rawKey: string,
  tier: string,
): Promise<string> {
  const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

  const rows = await AppDataSource.query<{ id: string }[]>(
    `INSERT INTO developer_api_keys (
       developer_name, hashed_key, key_prefix, environment, tier, is_active
     )
     VALUES ($1, $2, $3, $4, $5, true)
     ON CONFLICT (hashed_key) DO UPDATE
       SET developer_name = EXCLUDED.developer_name,
           key_prefix = EXCLUDED.key_prefix,
           environment = EXCLUDED.environment,
           tier = EXCLUDED.tier,
           is_active = true
     RETURNING id`,
    [developerName, hashedKey, rawKey.slice(0, 16), 'TEST', tier],
  );

  return rows[0].id;
}

async function upsertLocationNode(
  node: LocationSeedNode,
  parentId: string | null,
): Promise<void> {
  const existing = await AppDataSource.query<{ id: string }[]>(
    `SELECT id FROM administrative_units WHERE code = $1 LIMIT 1`,
    [node.code],
  );

  let unitId: string;

  if (existing.length > 0) {
    unitId = existing[0].id;
    await AppDataSource.query(
      `UPDATE administrative_units
       SET name = $1, level = $2, is_active = true, parent_id = $3
       WHERE id = $4`,
      [node.name, node.level, parentId, unitId],
    );
  } else {
    const inserted = await AppDataSource.query<{ id: string }[]>(
      `INSERT INTO administrative_units (name, level, code, is_active, parent_id)
       VALUES ($1, $2, $3, true, $4)
       RETURNING id`,
      [node.name, node.level, node.code, parentId],
    );
    unitId = inserted[0].id;
  }

  if (node.children?.length) {
    for (const child of node.children) {
      await upsertLocationNode(child, unitId);
    }
  }
}

async function seedAdministrativeUnits(): Promise<number> {
  const existing = await AppDataSource.query<{ count: string }[]>(
    `SELECT COUNT(*)::text AS count FROM administrative_units WHERE level = 'PROVINCE'`,
  );

  if (Number(existing[0].count) > 0) {
    console.log('  Locations already seeded — refreshing hierarchy links.');
  }

  for (const province of RWANDA_LOCATION_GRAPH) {
    await upsertLocationNode(province, null);
  }

  const total = await AppDataSource.query<{ count: string }[]>(
    `SELECT COUNT(*)::text AS count FROM administrative_units WHERE is_active = true`,
  );

  return Number(total[0].count);
}

async function seedApiLogs(apiKeyId: string): Promise<number> {
  await AppDataSource.query(
    `DELETE FROM developer_api_logs WHERE api_key_id = $1`,
    [apiKeyId],
  );

  const endpoints = [
    '/v1/locations/root-provinces',
    '/v1/locations/children',
    '/v1/sandbox/payments/charge',
    '/v1/sandbox/payments/status/:transactionId',
    '/v1/compliance/nida/mock/:nationalId',
    '/v1/compliance/rra/taxes',
    '/v1/developer/workspace/complete-core-snapshot',
  ];

  const methods = ['GET', 'POST'];
  const statusCodes = [200, 201, 202, 400, 401, 500];
  const responseTimes = [42, 58, 73, 95, 112, 148, 201, 256, 310, 420];

  const values: unknown[] = [];
  const placeholders: string[] = [];

  for (let index = 0; index < 28; index += 1) {
    const endpoint = endpoints[index % endpoints.length];
    const method = methods[index % methods.length];
    const statusCode = statusCodes[index % statusCodes.length];
    const responseTimeMs = responseTimes[index % responseTimes.length];
    const offsetMinutes = index * 7;

    const base = index * 6;
    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, NOW() - ($${base + 6} || ' minutes')::interval)`,
    );
    values.push(
      apiKeyId,
      endpoint,
      method,
      statusCode,
      responseTimeMs,
      String(offsetMinutes),
    );
  }

  await AppDataSource.query(
    `INSERT INTO developer_api_logs (api_key_id, endpoint, method, status_code, response_time_ms, timestamp)
     VALUES ${placeholders.join(', ')}`,
    values,
  );

  return 28;
}

async function seedMockTransactions(apiKeyId: string): Promise<number> {
  await AppDataSource.query(
    `DELETE FROM sandbox_mock_transactions WHERE api_key_id = $1`,
    [apiKeyId],
  );

  const statuses: Array<{
    status: string;
    failureReason: string | null;
    amount: number;
    gateway: string;
  }> = [];

  for (let index = 0; index < 22; index += 1) {
    statuses.push({
      status: 'SUCCESS',
      failureReason: null,
      amount: 1500 + index * 250,
      gateway: index % 2 === 0 ? 'MTN_MOMO' : 'AIRTEL_MONEY',
    });
  }

  for (let index = 0; index < 16; index += 1) {
    statuses.push({
      status: 'PENDING',
      failureReason: null,
      amount: 2200 + index * 180,
      gateway: index % 2 === 0 ? 'MTN_MOMO' : 'AIRTEL_MONEY',
    });
  }

  const failureReasons = [
    'ERR_INSUFFICIENT_FUNDS',
    'ERR_USER_CANCELLATION_REJECT',
    'ERR_TIMEOUT_EXPIRED',
  ];

  for (let index = 0; index < 17; index += 1) {
    statuses.push({
      status: 'FAILED',
      failureReason: failureReasons[index % failureReasons.length],
      amount: 3003 + index * 100,
      gateway: index % 2 === 0 ? 'MTN_MOMO' : 'AIRTEL_MONEY',
    });
  }

  const values: unknown[] = [];
  const placeholders: string[] = [];

  statuses.forEach((entry, index) => {
    const base = index * 9;
    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, NOW() - ($${base + 9} || ' minutes')::interval)`,
    );

    values.push(
      apiKeyId,
      index % 2 === 0 ? '0781234567' : '0731234567',
      entry.amount,
      entry.gateway,
      entry.status,
      entry.failureReason,
      'https://webhook.kigalipack.test/payments/callback',
      `KP-REF-${String(index + 1).padStart(4, '0')}`,
      String(index * 3),
    );
  });

  await AppDataSource.query(
    `INSERT INTO sandbox_mock_transactions
      (api_key_id, phone_number, amount, gateway, status, failure_reason, webhook_url, client_reference, created_at)
     VALUES ${placeholders.join(', ')}`,
    values,
  );

  return statuses.length;
}

async function seed() {
  await AppDataSource.initialize();

  console.log('Seeding Kigali-Pack Cloud Engine reference data...\n');

  const freeDeveloperId = await upsertApiKey(
    'Test Developer',
    TEST_KEY,
    'FREE',
  );
  const proDeveloperId = await upsertApiKey(
    'Pro Tier Developer',
    PRO_TEST_KEY,
    'PRO',
  );

  console.log('  API keys seeded (FREE + PRO).');

  const locationCount = await seedAdministrativeUnits();
  console.log(`  Administrative units seeded: ${locationCount} active nodes.`);

  const logCount = await seedApiLogs(freeDeveloperId);
  console.log(`  Developer API logs seeded: ${logCount} telemetry footprints.`);

  const transactionCount = await seedMockTransactions(freeDeveloperId);
  console.log(
    `  Sandbox transactions seeded: ${transactionCount} records (SUCCESS/PENDING/FAILED).`,
  );

  await seedApiLogs(proDeveloperId);
  await seedMockTransactions(proDeveloperId);
  console.log('  Pro-tier developer analytics and sandbox history seeded.');

  console.log('\nSeed complete. Use these credentials in Swagger:');
  console.log(`  FREE tier: Bearer ${TEST_KEY}`);
  console.log(`  PRO tier:  Bearer ${PRO_TEST_KEY}`);

  await AppDataSource.destroy();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
