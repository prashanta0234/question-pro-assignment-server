import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGroceryItems1744300001000 implements MigrationInterface {
  name = 'CreateGroceryItems1744300001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "grocery_items" (
        "id"                  UUID          NOT NULL DEFAULT gen_random_uuid(),
        "name"                VARCHAR(200)  NOT NULL,
        "description"         TEXT,
        "price"               DECIMAL(10,2) NOT NULL,
        "stock"               INTEGER       NOT NULL DEFAULT 0,
        "low_stock_notified"  BOOLEAN       NOT NULL DEFAULT false,
        "created_at"          TIMESTAMP     NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMP     NOT NULL DEFAULT now(),
        "deleted_at"          TIMESTAMP,
        CONSTRAINT "PK_grocery_items"       PRIMARY KEY ("id"),
        CONSTRAINT "CHK_grocery_price_pos"  CHECK ("price" > 0),
        CONSTRAINT "CHK_grocery_stock_nneg" CHECK ("stock" >= 0)
      )
    `);

    // Partial index — active items only (user listing fast path)
    await queryRunner.query(`
      CREATE INDEX "IDX_grocery_items_active"
        ON "grocery_items" ("id")
        WHERE deleted_at IS NULL
    `);

    // Available items — stock > 0 AND not deleted (most common query)
    await queryRunner.query(`
      CREATE INDEX "IDX_grocery_items_available"
        ON "grocery_items" ("id")
        WHERE deleted_at IS NULL AND stock > 0
    `);

    // Stock index for low-stock alert job
    await queryRunner.query(`
      CREATE INDEX "IDX_grocery_items_stock"
        ON "grocery_items" ("stock")
        WHERE deleted_at IS NULL
    `);

    // Full-text search on name (GIN index for ILIKE/to_tsvector)
    await queryRunner.query(`
      CREATE INDEX "IDX_grocery_items_name_search"
        ON "grocery_items"
        USING GIN (to_tsvector('english', name))
    `);

    // Name ordering index — most common sort
    await queryRunner.query(`
      CREATE INDEX "IDX_grocery_items_name"
        ON "grocery_items" ("name")
        WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_grocery_items_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_grocery_items_name_search"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_grocery_items_stock"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_grocery_items_available"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_grocery_items_active"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "grocery_items"`);
  }
}
