import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { LocationSeeder } from './location-seeder';
import { ApiKeyEntity } from '../../modules/auth/entities/api-key.entity';
import { ApiLogEntity } from '../../modules/analytics/entities/api-log.entity';
import { AdministrativeUnitEntity } from '../../modules/locations/entities/administrative-unit.entity';
import { MockTransactionEntity } from '../../modules/sandbox/entities/mock-transaction.entity';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'kigalipack_db',
  entities: [
    ApiKeyEntity,
    ApiLogEntity,
    AdministrativeUnitEntity,
    MockTransactionEntity,
  ],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});

async function execute(): Promise<void> {
  try {
    console.log(
      '[run-seeder] Connecting to PostgreSQL via TypeORM DataSource...',
    );
    console.log(
      `[run-seeder] Target: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'kigalipack_db'}`,
    );

    await AppDataSource.initialize();
    console.log(
      '[run-seeder] Connection established. Launching LocationSeeder.run()...',
    );

    await LocationSeeder.run(AppDataSource);

    console.log('[run-seeder] Location seeding cycle completed successfully.');
    await AppDataSource.destroy();
    console.log('[run-seeder] DataSource destroyed. Exiting with code 0.');
    process.exit(0);
  } catch (error) {
    console.error(
      '[run-seeder] Fatal failure during database seeding execution:',
      error,
    );

    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.error('[run-seeder] DataSource destroyed after failure.');
    }

    process.exit(1);
  }
}

void execute();
