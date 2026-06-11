import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

import { ApiKeyEntity } from './modules/auth/entities/api-key.entity';
import { ApiLogEntity } from './modules/analytics/entities/api-log.entity';
import { AdministrativeUnitEntity } from './modules/locations/entities/administrative-unit.entity';
import { MockTransactionEntity } from './modules/sandbox/entities/mock-transaction.entity';

import { LocationsController } from './modules/locations/locations.controller';
import { SandboxController } from './modules/sandbox/sandbox.controller';
import { KycController } from './modules/kyc/kyc.controller';
import { ApiKeyGuard } from './common/guards/api-key.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
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
    }),
    TypeOrmModule.forFeature([
      ApiKeyEntity,
      ApiLogEntity,
      AdministrativeUnitEntity,
      MockTransactionEntity,
    ]),
    HttpModule,
  ],
  controllers: [LocationsController, SandboxController, KycController],
  providers: [ApiKeyGuard],
})
export class AppModule {}
