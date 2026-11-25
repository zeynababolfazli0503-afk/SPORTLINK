/**
 * SPORTLINK — Deterministic UUID & Data Normalization Helpers for PostgreSQL Seeding
 */

import { createHash, randomBytes, scryptSync } from 'node:crypto';

/**
 * Maps a deterministic legacy string ID (e.g. 'user-member-1', 'club-sajjad-arena')
 * to a valid RFC 4122 UUID so seeders remain 100% idempotent across runs.
 */
export function deterministicUuid(namespace: string, legacyId: string): string {
  const hash = createHash('sha256').update(`sportlink:${namespace}:${legacyId}`).digest();
  // Set RFC 4122 version 5 & variant bits cleanly
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * Generates an scrypt password hash for development seed users without storing plaintext passwords.
 */
export function hashSeedPassword(secretInput: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(secretInput, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

/**
 * Slugifies Persian/Latin catalog labels into deterministic URL-safe slugs.
 */
export function makeCatalogSlug(prefix: string, index: number, asciiHint?: string): string {
  if (asciiHint) return asciiHint.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${prefix}-${index + 1}`;
}

export function normalizeScheduleTime(value: string | undefined): string | null {
  if (!value || value === 'closed') return null;
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  return null;
}
