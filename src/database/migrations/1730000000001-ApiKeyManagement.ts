import { MigrationInterface, QueryRunner } from 'typeorm';

export class ApiKeyManagement1730000000001 implements MigrationInterface {
  name = 'ApiKeyManagement1730000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "developer_api_keys"
        ADD COLUMN "name" character varying(100),
        ADD COLUMN "key_prefix" character varying(20),
        ADD COLUMN "environment" character varying(20) NOT NULL DEFAULT 'TEST',
        ADD COLUMN "expires_at" TIMESTAMPTZ,
        ADD COLUMN "last_used_at" TIMESTAMPTZ,
        ADD COLUMN "revoked_at" TIMESTAMPTZ
    `);

    await queryRunner.query(`
      UPDATE "developer_api_keys"
      SET "key_prefix" = 'kp_test_legacy',
          "environment" = 'TEST'
      WHERE "key_prefix" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "developer_api_keys"
        ALTER COLUMN "key_prefix" SET NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_developer_api_keys_developer_name_is_active"
        ON "developer_api_keys" ("developer_name", "is_active")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_developer_api_keys_hashed_key_is_active"
        ON "developer_api_keys" ("hashed_key", "is_active")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_developer_api_keys_environment"
        ON "developer_api_keys" ("environment")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_developer_api_keys_expires_at"
        ON "developer_api_keys" ("expires_at")
        WHERE "expires_at" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_developer_api_keys_expires_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_developer_api_keys_environment"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_developer_api_keys_hashed_key_is_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_developer_api_keys_developer_name_is_active"`,
    );

    await queryRunner.query(`
      ALTER TABLE "developer_api_keys"
        DROP COLUMN "revoked_at",
        DROP COLUMN "last_used_at",
        DROP COLUMN "expires_at",
        DROP COLUMN "environment",
        DROP COLUMN "key_prefix",
        DROP COLUMN "name"
    `);
  }
}
