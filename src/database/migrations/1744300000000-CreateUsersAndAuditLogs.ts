import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersAndAuditLogs1744300000000 implements MigrationInterface {
  name = 'CreateUsersAndAuditLogs1744300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enums
    await queryRunner.query(`
      CREATE TYPE "public"."users_role_enum" AS ENUM('ADMIN', 'USER')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."audit_logs_userrole_enum" AS ENUM('ADMIN', 'USER', 'SYSTEM')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."audit_logs_action_enum" AS ENUM(
        'USER_REGISTERED',
        'USER_LOGIN',
        'USER_LOGIN_FAILED',
        'GROCERY_CREATED',
        'GROCERY_UPDATED',
        'GROCERY_DELETED',
        'INVENTORY_UPDATED',
        'ORDER_PLACED',
        'ORDER_PLACE_FAILED',
        'LOW_STOCK_ALERT'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."audit_logs_status_enum" AS ENUM('SUCCESS', 'FAILURE')
    `);

    // Users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"          UUID              NOT NULL DEFAULT gen_random_uuid(),
        "email"       VARCHAR(255)      NOT NULL,
        "password"    VARCHAR(255)      NOT NULL,
        "role"        "public"."users_role_enum" NOT NULL DEFAULT 'USER',
        "created_at"  TIMESTAMP         NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMP         NOT NULL DEFAULT now(),
        "deleted_at"  TIMESTAMP,
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_users_email" ON "users" ("email")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_role" ON "users" ("role")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_deleted_at" ON "users" ("deleted_at")`);

    // Audit logs table (append-only — no UPDATE/DELETE allowed via app code)
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id"              UUID              NOT NULL DEFAULT gen_random_uuid(),
        "user_id"         UUID,
        "user_role"       "public"."audit_logs_userrole_enum" NOT NULL,
        "action"          "public"."audit_logs_action_enum"   NOT NULL,
        "entity"          VARCHAR(50)       NOT NULL,
        "entity_id"       UUID,
        "before_data"     JSONB,
        "after_data"      JSONB,
        "ip_address"      VARCHAR(45)       NOT NULL,
        "user_agent"      VARCHAR(255),
        "request_id"      VARCHAR(100)      NOT NULL,
        "status"          "public"."audit_logs_status_enum"   NOT NULL,
        "failure_reason"  TEXT,
        "metadata"        JSONB,
        "created_at"      TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_user_id"    ON "audit_logs" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_action"     ON "audit_logs" ("action")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_entity"     ON "audit_logs" ("entity", "entity_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_created_at" ON "audit_logs" ("created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_status"     ON "audit_logs" ("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."audit_logs_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."audit_logs_action_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."audit_logs_userrole_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_role_enum"`);
  }
}
