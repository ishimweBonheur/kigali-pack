import { MigrationInterface, QueryRunner } from 'typeorm';

export class BillingEnhancements1730000000005 implements MigrationInterface {
  name = 'BillingEnhancements1730000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update subscription status enum via check constraint
    await queryRunner.query(`
      ALTER TABLE "billing_subscriptions"
        DROP CONSTRAINT IF EXISTS "CHK_billing_subscriptions_status"
    `);

    // Add PENDING, REJECTED, EXPIRED statuses to subscription
    await queryRunner.query(`
      ALTER TABLE "billing_subscriptions"
        ADD CONSTRAINT "CHK_billing_subscriptions_status"
        CHECK (
          "status" IN ('PENDING', 'ACTIVE', 'REJECTED', 'EXPIRED', 'CANCELLED', 'PAST_DUE')
        )
    `);

    // Create payment_requests table
    await queryRunner.query(`
      CREATE TABLE "payment_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "user_email" character varying(255) NOT NULL,
        "subscription_id" uuid,
        "plan_id" uuid,
        "plan_name" character varying(100),
        "amount" numeric(12,2) NOT NULL,
        "currency" character varying(10) NOT NULL DEFAULT 'RWF',
        "payment_method" character varying(50),
        "transaction_reference" character varying(255),
        "payment_proof" text,
        "notes" text,
        "status" character varying(30) NOT NULL DEFAULT 'PENDING',
        "admin_notes" text,
        "rejection_reason" text,
        "reviewed_by" uuid,
        "reviewed_by_email" character varying(255),
        "reviewed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payment_requests_subscription"
          FOREIGN KEY ("subscription_id")
          REFERENCES "billing_subscriptions"("id")
          ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_requests_user_status" ON "payment_requests" ("user_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_requests_status_created" ON "payment_requests" ("status", "created_at")`,
    );

    // Create notifications table
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "user_email" character varying(255),
        "type" character varying(50) NOT NULL,
        "title" character varying(255) NOT NULL,
        "message" text NOT NULL,
        "data" jsonb,
        "read" boolean NOT NULL DEFAULT false,
        "read_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_read" ON "notifications" ("user_id", "read")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_created" ON "notifications" ("user_id", "created_at")`,
    );

    // Create audit_logs table
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "action" character varying(50) NOT NULL,
        "actor_id" uuid,
        "actor_email" character varying(255),
        "actor_role" character varying(50),
        "target_id" uuid,
        "target_email" character varying(255),
        "target_type" character varying(50),
        "description" text,
        "metadata" jsonb,
        "ip_address" character varying(50),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" ("action")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_actor_email" ON "audit_logs" ("actor_email")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_target_email" ON "audit_logs" ("target_email")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_created_at" ON "audit_logs" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_created_at"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_audit_logs_target_email"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_audit_logs_actor_email"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_action"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notifications_user_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notifications_user_read"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_payment_requests_status_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_payment_requests_user_status"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_requests"`);
    await queryRunner.query(`
      ALTER TABLE "billing_subscriptions"
        DROP CONSTRAINT IF EXISTS "CHK_billing_subscriptions_status"
    `);
    await queryRunner.query(`
      ALTER TABLE "billing_subscriptions"
        ADD CONSTRAINT "CHK_billing_subscriptions_status"
        CHECK ("status" IN ('ACTIVE', 'CANCELLED', 'PAST_DUE'))
    `);
  }
}
