/**
 * SPORTLINK — PostgreSQL Configuration Loader
 * Reads database settings strictly from environment variables (never hardcoded secrets).
 */

import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean | { rejectUnauthorized: boolean };
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  timezone: string;
}

function parseInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`Invalid numeric database configuration value (expected ${min}-${max}).`);
  }
  return parsed;
}

function parseSsl(value: string | undefined): boolean | { rejectUnauthorized: boolean } {
  const normalized = (value || 'false').trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'require') {
    return { rejectUnauthorized: true };
  }
  if (normalized === 'no-verify') {
    return { rejectUnauthorized: false };
  }
  return false;
}

export function loadDbConfig(env: NodeJS.ProcessEnv = process.env): DbConfig {
  const timezone = (env.APP_TIMEZONE || 'Asia/Tehran').trim();
  if (!/^[A-Za-z_]+\/[A-Za-z_]+$/.test(timezone)) {
    throw new Error('Invalid APP_TIMEZONE format.');
  }

  return {
    host: (env.PGHOST || 'localhost').trim(),
    port: parseInteger(env.PGPORT, 5432, 1, 65535),
    database: (env.PGDATABASE || 'sportlink').trim(),
    user: (env.PGUSER || 'sportlink_app').trim(),
    password: env.PGPASSWORD ?? '',
    ssl: parseSsl(env.PGSSL),
    max: parseInteger(env.PGPOOL_MAX, 10, 1, 100),
    idleTimeoutMillis: parseInteger(env.PGPOOL_IDLE_TIMEOUT_MS, 30000, 1000, 300000),
    connectionTimeoutMillis: parseInteger(env.PGPOOL_CONNECTION_TIMEOUT_MS, 5000, 500, 60000),
    timezone,
  };
}

export function hasExplicitDbCredentials(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.PGHOST?.trim() &&
      env.PGDATABASE?.trim() &&
      env.PGUSER?.trim() &&
      env.PGPASSWORD !== undefined &&
      env.PGPASSWORD !== ''
  );
}
