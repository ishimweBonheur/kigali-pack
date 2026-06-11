import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1730000000000 implements MigrationInterface {
  name = 'InitialSchema1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "developer_api_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "developer_name" character varying(255) NOT NULL,
        "hashed_key" character varying(64) NOT NULL,
        "tier" character varying(50) NOT NULL DEFAULT 'FREE',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_developer_api_keys" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_developer_api_keys_hashed_key" ON "developer_api_keys" ("hashed_key")`,
    );

    await queryRunner.query(`
      CREATE TABLE "developer_api_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "api_key_id" uuid,
        "endpoint" character varying(255) NOT NULL,
        "method" character varying(10) NOT NULL,
        "status_code" integer NOT NULL,
        "response_time_ms" integer NOT NULL,
        "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_developer_api_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_developer_api_logs_api_key" FOREIGN KEY ("api_key_id")
          REFERENCES "developer_api_keys"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_developer_api_logs_api_key_id" ON "developer_api_logs" ("api_key_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_developer_api_logs_timestamp" ON "developer_api_logs" ("timestamp")`,
    );

    await queryRunner.query(`
      CREATE TYPE "administrative_units_level_enum" AS ENUM(
        'PROVINCE', 'DISTRICT', 'SECTOR', 'CELL', 'VILLAGE'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "administrative_units" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(150) NOT NULL,
        "level" "administrative_units_level_enum" NOT NULL,
        "code" character varying(50),
        "is_active" boolean NOT NULL DEFAULT true,
        "parent_id" uuid,
        CONSTRAINT "PK_administrative_units" PRIMARY KEY ("id"),
        CONSTRAINT "FK_administrative_units_parent" FOREIGN KEY ("parent_id")
          REFERENCES "administrative_units"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_administrative_units_name" ON "administrative_units" ("name")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_administrative_units_code" ON "administrative_units" ("code") WHERE "code" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_administrative_units_level_is_active" ON "administrative_units" ("level", "is_active")`,
    );

    await queryRunner.query(`
      CREATE TABLE "sandbox_mock_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "api_key_id" uuid,
        "phone_number" character varying(15) NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "gateway" character varying(20) NOT NULL,
        "status" character varying(30) NOT NULL DEFAULT 'PENDING',
        "failure_reason" character varying(100),
        "webhook_url" character varying(500) NOT NULL,
        "client_reference" character varying(100) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sandbox_mock_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sandbox_mock_transactions_api_key" FOREIGN KEY ("api_key_id")
          REFERENCES "developer_api_keys"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_sandbox_mock_transactions_client_reference" ON "sandbox_mock_transactions" ("client_reference")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sandbox_mock_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "administrative_units"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "administrative_units_level_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "developer_api_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "developer_api_keys"`);
  }
}
