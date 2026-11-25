/**
 * SPORTLINK — Versioned PostgreSQL Migration & Rollback Runner
 * Tracks applied SQL migrations inside `schema_migrations` using checksums and transactions.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';
import { getDbPool, withTransaction } from './pool.js';

export interface MigrationPair {
  version: string;
  name: string;
  upFilename: string;
  downFilename: string;
  upSql: string;
  downSql: string;
  checksum: string;
}

const DEFAULT_MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'migrations');

export function loadMigrationPairs(migrationsDir: string = DEFAULT_MIGRATIONS_DIR): MigrationPair[] {
  const files = readdirSync(migrationsDir).sort();
  const upFiles = files.filter((f) => /^\d{3}_.+\.up\.sql$/.test(f));

  return upFiles.map((upFilename) => {
    const match = upFilename.match(/^(\d{3})_(.+)\.up\.sql$/);
    if (!match) {
      throw new Error(`Invalid migration filename: ${upFilename}`);
    }
    const [, version, name] = match;
    const downFilename = `${version}_${name}.down.sql`;
    if (!files.includes(downFilename)) {
      throw new Error(`Missing rollback file ${downFilename} for migration ${upFilename}`);
    }

    const upSql = readFileSync(resolve(migrationsDir, upFilename), 'utf8');
    const downSql = readFileSync(resolve(migrationsDir, downFilename), 'utf8');
    const checksum = createHash('sha256').update(upSql).digest('hex');

    return {
      version,
      name,
      upFilename,
      downFilename,
      upSql,
      downSql,
      checksum,
    };
  });
}

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function getAppliedMigrations(pool: Pool = getDbPool()): Promise<
  Array<{ version: string; filename: string; checksum: string; applied_at: Date }>
> {
  await ensureMigrationsTable(pool);
  const res = await pool.query<{ version: string; filename: string; checksum: string; applied_at: Date }>(
    'SELECT version, filename, checksum, applied_at FROM schema_migrations ORDER BY version ASC'
  );
  return res.rows;
}

export async function migrateUp(
  pool: Pool = getDbPool(),
  migrationsDir: string = DEFAULT_MIGRATIONS_DIR
): Promise<string[]> {
  const pairs = loadMigrationPairs(migrationsDir);
  const applied = await getAppliedMigrations(pool);
  const appliedMap = new Map(applied.map((row) => [row.version, row]));
  const newlyApplied: string[] = [];

  for (const migration of pairs) {
    const existing = appliedMap.get(migration.version);
    if (existing) {
      if (existing.checksum !== migration.checksum) {
        throw new Error(
          `Migration ${migration.upFilename} checksum mismatch (applied migration was modified).`
        );
      }
      continue;
    }

    await withTransaction(async (client) => {
      await client.query(migration.upSql);
      await client.query(
        'INSERT INTO schema_migrations (version, filename, checksum) VALUES ($1, $2, $3)',
        [migration.version, migration.upFilename, migration.checksum]
      );
    }, pool);

    newlyApplied.push(migration.upFilename);
  }

  return newlyApplied;
}

export async function migrateDown(
  pool: Pool = getDbPool(),
  steps = 1,
  migrationsDir: string = DEFAULT_MIGRATIONS_DIR
): Promise<string[]> {
  if (!Number.isInteger(steps) || steps < 1) {
    throw new Error('Rollback steps must be a positive integer.');
  }

  const pairs = loadMigrationPairs(migrationsDir);
  const pairByVersion = new Map(pairs.map((p) => [p.version, p]));
  const applied = await getAppliedMigrations(pool);
  const toRollback = [...applied].reverse().slice(0, steps);
  const rolledBack: string[] = [];

  for (const row of toRollback) {
    const pair = pairByVersion.get(row.version);
    if (!pair) {
      throw new Error(`Rollback SQL not found for applied migration version ${row.version}`);
    }

    await withTransaction(async (client) => {
      await client.query(pair.downSql);
      await client.query('DELETE FROM schema_migrations WHERE version = $1', [row.version]);
    }, pool);

    rolledBack.push(pair.downFilename);
  }

  return rolledBack;
}

export async function getMigrationStatus(
  pool: Pool = getDbPool(),
  migrationsDir: string = DEFAULT_MIGRATIONS_DIR
): Promise<Array<{ version: string; filename: string; applied: boolean; appliedAt: Date | null }>> {
  const pairs = loadMigrationPairs(migrationsDir);
  const applied = await getAppliedMigrations(pool);
  const appliedMap = new Map(applied.map((a) => [a.version, a]));

  return pairs.map((pair) => {
    const found = appliedMap.get(pair.version);
    return {
      version: pair.version,
      filename: pair.upFilename,
      applied: Boolean(found),
      appliedAt: found?.applied_at || null,
    };
  });
}
