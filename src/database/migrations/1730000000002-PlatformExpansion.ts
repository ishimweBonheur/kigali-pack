import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlatformExpansion1730000000002 implements MigrationInterface {
  name = 'PlatformExpansion1730000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "api_usage_daily" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "api_key_id" uuid NOT NULL,
        "endpoint" character varying(255) NOT NULL,
        "usage_date" date NOT NULL,
        "requests" integer NOT NULL DEFAULT 0,
        "average_latency_ms" numeric(10,2) NOT NULL DEFAULT 0,
        "error_count" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_api_usage_daily" PRIMARY KEY ("id"),
        CONSTRAINT "FK_api_usage_daily_api_key" FOREIGN KEY ("api_key_id")
          REFERENCES "developer_api_keys"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_api_usage_daily_key_endpoint_date"
          UNIQUE ("api_key_id", "endpoint", "usage_date")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_api_usage_daily_api_key_date" ON "api_usage_daily" ("api_key_id", "usage_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_api_usage_daily_endpoint" ON "api_usage_daily" ("endpoint")`,
    );

    await queryRunner.query(`
      ALTER TABLE "sandbox_mock_transactions"
        ADD COLUMN "completed_at" TIMESTAMPTZ
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_sandbox_mock_transactions_api_key_created"
        ON "sandbox_mock_transactions" ("api_key_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sandbox_mock_transactions_status"
        ON "sandbox_mock_transactions" ("status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "webhooks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "api_key_id" uuid NOT NULL,
        "url" character varying(500) NOT NULL,
        "secret" character varying(128) NOT NULL,
        "events" text[] NOT NULL DEFAULT '{}',
        "description" character varying(255),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_webhooks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_webhooks_api_key" FOREIGN KEY ("api_key_id")
          REFERENCES "developer_api_keys"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_webhooks_api_key_id" ON "webhooks" ("api_key_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "webhook_deliveries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "webhook_id" uuid NOT NULL,
        "event_type" character varying(100) NOT NULL,
        "payload" jsonb NOT NULL,
        "status" character varying(30) NOT NULL DEFAULT 'PENDING',
        "attempt_count" integer NOT NULL DEFAULT 0,
        "max_attempts" integer NOT NULL DEFAULT 5,
        "last_attempt_at" TIMESTAMPTZ,
        "next_retry_at" TIMESTAMPTZ,
        "response_status" integer,
        "response_body" text,
        "error_message" character varying(500),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_webhook_deliveries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_webhook_deliveries_webhook" FOREIGN KEY ("webhook_id")
          REFERENCES "webhooks"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_webhook_deliveries_webhook_id" ON "webhook_deliveries" ("webhook_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_webhook_deliveries_status_next_retry"
        ON "webhook_deliveries" ("status", "next_retry_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "billing_plans" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(50) NOT NULL,
        "name" character varying(100) NOT NULL,
        "description" text,
        "price_monthly_rwf" numeric(12,2) NOT NULL DEFAULT 0,
        "rate_limit_per_hour" integer,
        "features" jsonb NOT NULL DEFAULT '[]',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_billing_plans" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_billing_plans_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "billing_subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "developer_name" character varying(255) NOT NULL,
        "plan_id" uuid NOT NULL,
        "status" character varying(30) NOT NULL DEFAULT 'ACTIVE',
        "current_period_start" TIMESTAMPTZ NOT NULL,
        "current_period_end" TIMESTAMPTZ NOT NULL,
        "cancelled_at" TIMESTAMPTZ,
        "momo_reference" character varying(100),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_billing_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_billing_subscriptions_plan" FOREIGN KEY ("plan_id")
          REFERENCES "billing_plans"("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_billing_subscriptions_developer"
        ON "billing_subscriptions" ("developer_name", "status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "billing_invoices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "subscription_id" uuid NOT NULL,
        "amount_rwf" numeric(12,2) NOT NULL,
        "status" character varying(30) NOT NULL DEFAULT 'OPEN',
        "due_date" date NOT NULL,
        "paid_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_billing_invoices" PRIMARY KEY ("id"),
        CONSTRAINT "FK_billing_invoices_subscription" FOREIGN KEY ("subscription_id")
          REFERENCES "billing_subscriptions"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_billing_invoices_subscription"
        ON "billing_invoices" ("subscription_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(255) NOT NULL,
        "slug" character varying(100) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organizations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_organizations_slug" UNIQUE ("slug")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "organization_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "email" character varying(255) NOT NULL,
        "password_hash" character varying(128) NOT NULL,
        "role" character varying(30) NOT NULL DEFAULT 'DEVELOPER',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organization_members" PRIMARY KEY ("id"),
        CONSTRAINT "FK_organization_members_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_organization_members_org_email"
          UNIQUE ("organization_id", "email")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_organization_members_email" ON "organization_members" ("email")`,
    );

    await queryRunner.query(`
      CREATE INDEX "IDX_developer_api_logs_api_key_endpoint"
        ON "developer_api_logs" ("api_key_id", "endpoint")`);
    await queryRunner.query(`
      CREATE INDEX "IDX_developer_api_logs_status_code"
        ON "developer_api_logs" ("status_code")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_developer_api_logs_status_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_developer_api_logs_api_key_endpoint"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organizations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "billing_invoices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "billing_subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "billing_plans"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_deliveries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "webhooks"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sandbox_mock_transactions_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sandbox_mock_transactions_api_key_created"`,
    );
    await queryRunner.query(`
      ALTER TABLE "sandbox_mock_transactions" DROP COLUMN IF EXISTS "completed_at"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "api_usage_daily"`);
  }
}
