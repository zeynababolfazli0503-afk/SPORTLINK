/**
 * SPORTLINK — Database CLI (migrate:up, migrate:down, migrate:status, seed:catalog, seed:dev)
 */

import { hasExplicitDbCredentials } from './config.js';
import { closeDbPool, getDbPool, verifyDatabaseHealth } from './pool.js';
import { getMigrationStatus, migrateDown, migrateUp } from './migrate.js';
import { seedCatalog } from './seeds/seed-catalog.js';
import { seedDev } from './seeds/seed-dev.js';

async function main(): Promise<void> {
  const command = process.argv[2] || 'migrate:status';
  const arg = process.argv[3];

  if (!hasExplicitDbCredentials() && !process.env.PGHOST) {
    console.warn('[SPORTLINK DB] Using default PGHOST/PGDATABASE/PGUSER; configure .env before running against PostgreSQL.');
  }

  const pool = getDbPool();

  try {
    const health = await verifyDatabaseHealth(pool);
    console.log(
      `[SPORTLINK DB] Connected (${health.encoding}, TZ=${health.timezone})`
    );

    if (command === 'migrate:up') {
      const applied = await migrateUp(pool);
      console.log(
        applied.length
          ? `[SPORTLINK DB] Applied migrations: ${applied.join(', ')}`
          : '[SPORTLINK DB] All migrations are already applied.'
      );
    } else if (command === 'migrate:down') {
      const steps = arg ? Number.parseInt(arg, 10) : 1;
      const rolledBack = await migrateDown(pool, steps);
      console.log(
        rolledBack.length
          ? `[SPORTLINK DB] Rolled back: ${rolledBack.join(', ')}`
          : '[SPORTLINK DB] No applied migrations to roll back.'
      );
    } else if (command === 'migrate:status') {
      const statuses = await getMigrationStatus(pool);
      for (const s of statuses) {
        console.log(`${s.applied ? '[APPLIED]' : '[PENDING]'} ${s.version} - ${s.filename}`);
      }
    } else if (command === 'seed:catalog') {
      await seedCatalog(pool);
      console.log('[SPORTLINK DB] Catalog seed completed.');
    } else if (command === 'seed:dev') {
      await seedDev(pool);
      console.log('[SPORTLINK DB] Development seed completed.');
    } else {
      console.error(`Unknown command: ${command}`);
      process.exitCode = 1;
    }
  } finally {
    await closeDbPool(pool);
  }
}

main().catch((err) => {
  console.error('[SPORTLINK DB] Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
