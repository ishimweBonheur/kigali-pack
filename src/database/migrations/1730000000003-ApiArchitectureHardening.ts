import { MigrationInterface, QueryRunner } from 'typeorm';

export class ApiArchitectureHardening1730000000003 implements MigrationInterface {
  name = 'ApiArchitectureHardening1730000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "member_id" uuid NOT NULL,
        "token_hash" varchar(64) NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "revoked_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_refresh_tokens_member" FOREIGN KEY ("member_id")
          REFERENCES "organization_members"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash")`,
    );

    await queryRunner.query(
      `ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "duration_ms" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhook_deliveries" DROP COLUMN IF EXISTS "duration_ms"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_refresh_tokens_token_hash"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
  }
}
