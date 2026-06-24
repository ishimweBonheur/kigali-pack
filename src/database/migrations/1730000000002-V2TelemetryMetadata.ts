import { MigrationInterface, QueryRunner } from 'typeorm';

export class V2TelemetryMetadata1730000000002 implements MigrationInterface {
  name = 'V2TelemetryMetadata1730000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "developer_api_logs"
      ADD COLUMN IF NOT EXISTS "developer_id" uuid
    `);

    await queryRunner.query(`
      UPDATE "developer_api_logs"
      SET "developer_id" = "api_key_id"
      WHERE "developer_id" IS NULL AND "api_key_id" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "developer_api_logs"
      ADD COLUMN IF NOT EXISTS "masked_request_snapshot" text
    `);

    await queryRunner.query(`
      ALTER TABLE "developer_api_logs"
      ADD COLUMN IF NOT EXISTS "masked_response_snapshot" text
    `);

    await queryRunner.query(`
      ALTER TABLE "developer_api_logs"
      ADD COLUMN IF NOT EXISTS "processing_mode" character varying(20) NOT NULL DEFAULT 'stateful'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_developer_api_logs_developer_id"
      ON "developer_api_logs" ("developer_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_developer_api_logs_developer_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "developer_api_logs" DROP COLUMN IF EXISTS "processing_mode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "developer_api_logs" DROP COLUMN IF EXISTS "masked_response_snapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "developer_api_logs" DROP COLUMN IF EXISTS "masked_request_snapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "developer_api_logs" DROP COLUMN IF EXISTS "developer_id"`,
    );
  }
}
