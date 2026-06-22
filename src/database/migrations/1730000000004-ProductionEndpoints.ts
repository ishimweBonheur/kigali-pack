import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductionEndpoints1730000000004 implements MigrationInterface {
  name = 'ProductionEndpoints1730000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organization_members"
      ADD COLUMN IF NOT EXISTS "email_verified" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE TABLE "auth_action_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "member_id" uuid NOT NULL,
        "token_hash" varchar(64) NOT NULL,
        "type" varchar(30) NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "used_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_auth_action_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_auth_action_tokens_member" FOREIGN KEY ("member_id")
          REFERENCES "organization_members"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_auth_action_tokens_hash_type" ON "auth_action_tokens" ("token_hash", "type")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_auth_action_tokens_hash_type"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "auth_action_tokens"`);
    await queryRunner.query(
      `ALTER TABLE "organization_members" DROP COLUMN IF EXISTS "email_verified"`,
    );
  }
}
