/**
 * SPORTLINK — PostgreSQL Connection Pool & Transaction Infrastructure
 * Uses `pg` driver with parameterized SQL, explicit client release, and Asia/Tehran timezone.
 */

import pg from 'pg';
import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { loadDbConfig, type DbConfig } from './config.js';

const { Pool: PgPool } = pg;

export type Queryable = Pick<Pool | PoolClient, 'query'>;

export class SafeDatabaseError extends Error {
  public readonly code?: string;
  public readonly constraint?: string;

  constructor(message: string, code?: string, constraint?: string) {
    super(message);
    this.name = 'SafeDatabaseError';
    this.code = code;
    this.constraint = constraint;
  }
}

function sanitizeDbError(err: unknown): SafeDatabaseError {
  if (err instanceof SafeDatabaseError) return err;
  const pgErr = err as { code?: string; constraint?: string; message?: string } | undefined;
  const code = typeof pgErr?.code === 'string' ? pgErr.code : undefined;
  const constraint = typeof pgErr?.constraint === 'string' ? pgErr.constraint : undefined;
  const detail = typeof pgErr?.message === 'string' ? pgErr.message : 'Database operation failed';
  return new SafeDatabaseError(detail, code, constraint);
}

let sharedPool: Pool | null = null;

export function createDbPool(config: DbConfig = loadDbConfig()): Pool {
  const pool = new PgPool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl,
    max: config.max,
    idleTimeoutMillis: config.idleTimeoutMillis,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
    options: `-c TimeZone=${config.timezone} -c client_encoding=UTF8`,
  });

  pool.on('error', (err) => {
    const safe = sanitizeDbError(err);
    console.error(`[SPORTLINK DB] Unexpected idle client error (${safe.code || 'UNKNOWN'}): ${safe.message}`);
  });

  return pool;
}

export function getDbPool(): Pool {
  if (!sharedPool) {
    sharedPool = createDbPool();
  }
  return sharedPool;
}

export async function closeDbPool(pool: Pool | null = sharedPool): Promise<void> {
  if (!pool) return;
  await pool.end();
  if (pool === sharedPool) {
    sharedPool = null;
  }
}

export async function runQuery<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: readonly unknown[] = [],
  executor: Queryable = getDbPool()
): Promise<QueryResult<T>> {
  try {
    return await executor.query<T>(sql, params as unknown[]);
  } catch (err) {
    throw sanitizeDbError(err);
  }
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
  pool: Pool = getDbPool()
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL TIME ZONE 'Asia/Tehran'");
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors if connection already closed
    }
    throw sanitizeDbError(err);
  } finally {
    client.release();
  }
}

export async function verifyDatabaseHealth(pool: Pool = getDbPool()): Promise<{
  connected: boolean;
  timezone: string;
  encoding: string;
  serverVersion: string;
}> {
  const res = await runQuery<{ timezone: string; encoding: string; server_version: string }>(
    `SELECT
       current_setting('TimeZone') AS timezone,
       current_setting('server_encoding') AS encoding,
       version() AS server_version`,
    [],
    pool
  );
  const row = res.rows[0];
  return {
    connected: true,
    timezone: row?.timezone || '',
    encoding: row?.encoding || '',
    serverVersion: row?.server_version || '',
  };
}
