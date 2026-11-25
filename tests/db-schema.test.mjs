import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMigrationPairs } from '../db/migrate.js';
import { deterministicUuid, normalizeScheduleTime } from '../db/ids.js';
import { loadDbConfig, hasExplicitDbCredentials } from '../db/config.js';
import {
  INITIAL_CLUBS,
  CATEGORIES,
  SPORTS,
  FACILITIES,
  MASHHAD_NEIGHBORHOODS,
  CLUB_TYPES,
  DEMO_USERS,
} from '../js/data.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const APPROVED_30_TABLES = [
  'cities',
  'neighborhoods',
  'club_types',
  'stored_files',
  'users',
  'sub_admin_permissions',
  'user_sessions',
  'otp_verifications',
  'sports_categories',
  'sports',
  'facilities',
  'clubs',
  'club_sports',
  'club_facilities',
  'club_images',
  'club_operating_hours',
  'club_daily_metrics',
  'user_favorite_clubs',
  'user_favorite_sports',
  'user_comparisons',
  'user_search_history',
  'club_management_requests',
  'club_change_requests',
  'club_edit_history',
  'club_reports',
  'contact_messages',
  'notifications',
  'notification_user_states',
  'admin_activity_logs',
  'platform_settings',
];

const EXCLUDED_MVP_IDENTIFIERS = [
  /\breservations\b/i,
  /\btime_slots\b/i,
  /\bpayments\b/i,
  /\bcoaches\b/i,
  /\bcoach_specializations\b/i,
  /\bclub_coaches\b/i,
  /\bmembership_plans\b/i,
  /\breviews\b/i,
  /\bratings\b/i,
];

test('Versioned migrations cover exact 30 approved tables and reversible down scripts', () => {
  const pairs = loadMigrationPairs();
  assert.equal(pairs.length, 4);

  const combinedUpSql = pairs.map((p) => p.upSql).join('\n');
  const combinedDownSql = pairs.map((p) => p.downSql).join('\n');

  const createdTables = [...combinedUpSql.matchAll(/CREATE TABLE\s+([a-z_]+)\s*\(/g)].map((m) => m[1]);
  assert.equal(createdTables.length, 30, `Expected 30 CREATE TABLE statements, found ${createdTables.length}`);
  assert.deepEqual(createdTables, APPROVED_30_TABLES);

  for (const table of APPROVED_30_TABLES) {
    assert.match(
      combinedDownSql,
      new RegExp(`DROP TABLE IF EXISTS\\s+${table};`),
      `Rollback SQL must drop ${table}`
    );
  }
});

test('SQL migrations contain zero excluded out-of-scope MVP features', () => {
  const pairs = loadMigrationPairs();
  const combinedSql = pairs.map((p) => `${p.upSql}\n${p.downSql}`).join('\n');
  for (const pattern of EXCLUDED_MVP_IDENTIFIERS) {
    assert.equal(pattern.test(combinedSql), false, `Out-of-scope pattern matched: ${pattern}`);
  }
});

test('Critical schema integrity constraints, triggers, and partial indexes are defined', () => {
  const pairs = loadMigrationPairs();
  const combinedUpSql = pairs.map((p) => p.upSql).join('\n');

  assert.match(combinedUpSql, /CONSTRAINT\s+fk_clubs_city_neighborhood\s+FOREIGN KEY\s*\(city_id,\s*neighborhood_id\)/);
  assert.match(combinedUpSql, /CREATE UNIQUE INDEX\s+uq_users_email_active\s+ON users\s*\(LOWER\(email\)\)\s+WHERE email IS NOT NULL AND deleted_at IS NULL/);
  assert.match(combinedUpSql, /CREATE UNIQUE INDEX\s+uq_users_mobile_active\s+ON users\s*\(mobile\)\s+WHERE deleted_at IS NULL/);
  assert.match(combinedUpSql, /CREATE UNIQUE INDEX\s+uq_mgmt_req_one_approved_per_club/);
  assert.match(combinedUpSql, /CREATE UNIQUE INDEX\s+idx_clubs_manager_unique/);
  assert.match(combinedUpSql, /CHECK \(slot_index IN \(1, 2\)\)/);
  assert.match(combinedUpSql, /CHECK \(id = 1\)/);

  const triggerMatches = [...combinedUpSql.matchAll(/EXECUTE FUNCTION set_updated_at\(\)/g)];
  assert.equal(triggerMatches.length, 10, 'All 10 mutable tables with updated_at must attach set_updated_at() trigger');
});

test('Catalog and seed mapping align 100% with js/data.js records', () => {
  assert.equal(MASHHAD_NEIGHBORHOODS.length, 8);
  assert.equal(CLUB_TYPES.length, 6);
  assert.equal(CATEGORIES.length, 7);
  assert.equal(SPORTS.length, 35);
  assert.equal(FACILITIES.length, 10);
  assert.equal(INITIAL_CLUBS.length, 16);
  assert.equal(DEMO_USERS.length, 4);

  // Deterministic UUID generation matches RFC-4122 format and is repeatable
  const u1 = deterministicUuid('club', 'club-sajjad-arena');
  const u2 = deterministicUuid('club', 'club-sajjad-arena');
  const u3 = deterministicUuid('club', 'club-vakilabad-aquatics');
  assert.equal(u1, u2);
  assert.notEqual(u1, u3);
  assert.match(u1, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

  // Every club operating hour in INITIAL_CLUBS normalizes cleanly for PostgreSQL TIME
  for (const club of INITIAL_CLUBS) {
    for (const day of ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri']) {
      const slot = club.hours[day];
      const open = normalizeScheduleTime(slot.open);
      const close = normalizeScheduleTime(slot.close);
      if (slot.open === 'closed') {
        assert.equal(open, null);
        assert.equal(close, null);
      } else {
        assert.match(open, /^\d{2}:\d{2}:00$/);
        assert.match(close, /^\d{2}:\d{2}:00$/);
        assert.ok(close > open, `Club ${club.id} day ${day} must have close > open`);
      }
    }
  }
});

test('.env.example provides PG environment variables without committing .env secrets', () => {
  const gitignore = readFileSync(resolve(ROOT, '.gitignore'), 'utf8');
assert.match(gitignore, /^\.env\*$/m);
assert.match(gitignore, /^!\.env\.example$/m);
  const envExample = readFileSync(resolve(ROOT, '.env.example'), 'utf8');
  for (const key of ['PGHOST=', 'PGPORT=', 'PGDATABASE=', 'PGUSER=', 'PGPASSWORD=', 'APP_TIMEZONE=Asia/Tehran']) {
    assert.ok(envExample.includes(key), `.env.example must define ${key}`);
  }

  const cfg = loadDbConfig({
    PGHOST: 'db.local',
    PGPORT: '5432',
    PGDATABASE: 'sportlink',
    PGUSER: 'sportlink_app',
    PGPASSWORD: 'secret-placeholder-for-test',
    APP_TIMEZONE: 'Asia/Tehran',
  });
  assert.equal(cfg.host, 'db.local');
  assert.equal(cfg.port, 5432);
  assert.equal(cfg.timezone, 'Asia/Tehran');
  assert.equal(hasExplicitDbCredentials({}), false);
});
