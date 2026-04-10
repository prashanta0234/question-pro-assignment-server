/**
 * Admin Seed Script
 *
 * Creates the first ADMIN user if one doesn't already exist.
 * Admin accounts MUST NOT be created via the public /auth/register endpoint —
 * that endpoint only creates USER role accounts (by design, per security.md).
 *
 * Usage:
 *   pnpm seed:admin
 *
 * Credentials are read from environment variables:
 *   ADMIN_EMAIL    — defaults to admin@example.com
 *   ADMIN_PASSWORD — must be set; no default for security
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config();

async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL ?? 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    console.error('[seed:admin] ERROR: ADMIN_PASSWORD env variable is required.');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('[seed:admin] ERROR: ADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('[seed:admin] Connected to database.');

  try {
    // Check if an ADMIN already exists to avoid duplicates
    const existing = await dataSource.query(
      `SELECT id, email FROM users WHERE role = 'ADMIN' LIMIT 1`,
    );

    if (existing.length > 0) {
      console.log(`[seed:admin] Admin already exists: ${existing[0].email as string} — skipping.`);
      return;
    }

    const hashed = await bcrypt.hash(password, 12);

    const result = await dataSource.query(
      `INSERT INTO users (id, email, password, role, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'ADMIN', now(), now())
       RETURNING id, email, role`,
      [email, hashed],
    );

    const admin = result[0] as { id: string; email: string; role: string };
    console.log(`[seed:admin] Admin created successfully:`);
    console.log(`  ID:    ${admin.id}`);
    console.log(`  Email: ${admin.email}`);
    console.log(`  Role:  ${admin.role}`);
  } finally {
    await dataSource.destroy();
    console.log('[seed:admin] Database connection closed.');
  }
}

seedAdmin().catch((err) => {
  console.error('[seed:admin] Fatal error:', err);
  process.exit(1);
});
