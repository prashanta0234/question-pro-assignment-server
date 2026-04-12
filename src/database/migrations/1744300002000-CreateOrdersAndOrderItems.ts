import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrdersAndOrderItems1744300002000 implements MigrationInterface {
  name = 'CreateOrdersAndOrderItems1744300002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // orders table
    await queryRunner.query(`
      CREATE TYPE "order_status_enum" AS ENUM ('CONFIRMED', 'CANCELLED')
    `);

    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id"               UUID             NOT NULL DEFAULT gen_random_uuid(),
        "user_id"          UUID             NOT NULL,
        "status"           "order_status_enum" NOT NULL DEFAULT 'CONFIRMED',
        "total_amount"     DECIMAL(10,2)    NOT NULL,
        "idempotency_key"  VARCHAR,
        "created_at"       TIMESTAMP        NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMP        NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orders"                PRIMARY KEY ("id"),
        CONSTRAINT "UQ_orders_idempotency"    UNIQUE ("idempotency_key"),
        CONSTRAINT "FK_orders_user"           FOREIGN KEY ("user_id") REFERENCES "users"("id")
      )
    `);

    // Indexes on orders — from architecture.md
    await queryRunner.query(`
      CREATE INDEX "IDX_orders_user_id" ON "orders" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_orders_status" ON "orders" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_orders_created_at" ON "orders" ("created_at" DESC)
    `);
    // Partial unique index — NULL idempotency_key rows are excluded (SQL standard)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_orders_idempotency_key"
        ON "orders" ("idempotency_key")
        WHERE "idempotency_key" IS NOT NULL
    `);

    // order_items table
    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id"               UUID          NOT NULL DEFAULT gen_random_uuid(),
        "order_id"         UUID          NOT NULL,
        "grocery_item_id"  UUID          NOT NULL,
        "quantity"         INTEGER       NOT NULL,
        "unit_price"       DECIMAL(10,2) NOT NULL,
        "subtotal"         DECIMAL(10,2) NOT NULL,
        CONSTRAINT "PK_order_items"             PRIMARY KEY ("id"),
        CONSTRAINT "CHK_order_items_qty_pos"    CHECK ("quantity" > 0),
        CONSTRAINT "FK_order_items_order"       FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_order_items_grocery"     FOREIGN KEY ("grocery_item_id") REFERENCES "grocery_items"("id")
      )
    `);

    // Indexes on order_items — from architecture.md
    await queryRunner.query(`
      CREATE INDEX "IDX_order_items_order_id" ON "order_items" ("order_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_order_items_grocery_item_id" ON "order_items" ("grocery_item_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_items_grocery_item_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_items_order_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_items"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_idempotency_key"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "order_status_enum"`);
  }
}
