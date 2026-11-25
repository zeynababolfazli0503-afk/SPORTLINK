import test from 'node:test';
import assert from 'node:assert/strict';
import { hasExplicitDbCredentials } from '../db/config.js';
import { closeDbPool, createDbPool, verifyDatabaseHealth, withTransaction } from '../db/pool.js';
import { migrateDown, migrateUp } from '../db/migrate.js';
import { seedCatalog } from '../db/seeds/seed-catalog.js';
import { seedDev } from '../db/seeds/seed-dev.js';
import { deterministicUuid } from '../db/ids.js';
import {
  approveManagementRequestTx,
  deleteNotificationForUserTx,
  listNotificationsForUser,
  markNotificationReadTx,
  recordSearchHistoryTx,
} from '../db/repositories.js';

const CAN_CONNECT = hasExplicitDbCredentials(process.env);
const SKIP_REASON =
  'No PostgreSQL credentials/server configured (PGHOST, PGDATABASE, PGUSER, PGPASSWORD required for live DB integration tests).';

test('Live PostgreSQL integration lifecycle (migrations, seeds, constraints, triggers, concurrency, rollback)', { skip: CAN_CONNECT ? false : SKIP_REASON }, async () => {
  const pool = createDbPool();

  try {
    const health = await verifyDatabaseHealth(pool);
    assert.equal(health.connected, true);
    assert.equal(health.encoding.toUpperCase(), 'UTF8');
    assert.equal(health.timezone, 'Asia/Tehran');

    // Clean slate rollback if previously migrated, then migrate up
    await migrateDown(pool, 4).catch(() => {});
    const applied = await migrateUp(pool);
    assert.equal(applied.length, 4);

    // Verify exact 30 domain tables exist
    const tablesRes = await pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations' ORDER BY tablename`
    );
    assert.equal(tablesRes.rows.length, 30);

    // Idempotent catalog & dev seeding (run twice)
    await seedCatalog(pool);
    await seedDev(pool);
    await seedDev(pool);

    const clubCountRes = await pool.query('SELECT COUNT(*)::int AS cnt FROM clubs');
    assert.equal(clubCountRes.rows[0].cnt, 16);

    const sportCountRes = await pool.query('SELECT COUNT(*)::int AS cnt FROM sports');
    assert.equal(sportCountRes.rows[0].cnt, 35);

    // Composite FK test: city + neighborhood from another city must fail
    await assert.rejects(async () => {
      await withTransaction(async (client) => {
        const cityRes = await client.query(
          `INSERT INTO cities (name, slug) VALUES ('تهران', 'tehran') RETURNING id`
        );
        const tehranId = cityRes.rows[0].id;
        const mashhadHoodRes = await client.query(
          `SELECT id FROM neighborhoods WHERE slug = 'sajjad'`
        );
        const typeRes = await client.query(`SELECT id FROM club_types LIMIT 1`);
        await client.query(
          `INSERT INTO clubs (slug, name, club_type_id, city_id, neighborhood_id, short_address, full_address, phone)
           VALUES ('invalid-cross-city', 'باشگاه تست', $1, $2, $3, 'آدرس', 'آدرس کامل', '02112345678')`,
          [typeRes.rows[0].id, tehranId, mashhadHoodRes.rows[0].id]
        );
      }, pool);
    });

    // Soft-delete partial unique index test
    await withTransaction(async (client) => {
      const cityRes = await client.query(`SELECT id FROM cities WHERE slug = 'mashhad'`);
      const cityId = cityRes.rows[0].id;
      const inserted = await client.query(
        `INSERT INTO users (first_name, last_name, email, mobile, password_hash, city_id)
         VALUES ('تست', 'کاربر', 'softdel@sportlink.ir', '09159998877', 'hash1', $1)
         RETURNING id, updated_at`,
        [cityId]
      );
      const firstId = inserted.rows[0].id;
      const firstUpdated = inserted.rows[0].updated_at;

      await client.query(`UPDATE users SET deleted_at = NOW(), bio = 'deleted' WHERE id = $1`, [firstId]);
      const checkTrigger = await client.query(`SELECT updated_at FROM users WHERE id = $1`, [firstId]);
      assert.ok(new Date(checkTrigger.rows[0].updated_at) >= new Date(firstUpdated));

      // Re-registration with same mobile/email succeeds after soft delete
      await client.query(
        `INSERT INTO users (first_name, last_name, email, mobile, password_hash, city_id)
         VALUES ('تست', 'دوم', 'softdel@sportlink.ir', '09159998877', 'hash2', $1)`,
        [cityId]
      );
      throw new Error('ROLLBACK_TEST_TX');
    }, pool).catch((err) => {
      if (!String(err.message).includes('ROLLBACK_TEST_TX')) throw err;
    });

    // Search history 5-item concurrency-safe cap
    const memberUuid = deterministicUuid('user', 'user-member-1');
    await withTransaction(async (client) => {
      for (let i = 1; i <= 7; i += 1) {
        await recordSearchHistoryTx(client, {
          userId: memberUuid,
          queryTerm: `جستجو ${i}`,
          searchMode: 'clubs',
        });
      }
      const rows = await recordSearchHistoryTx(client, {
        userId: memberUuid,
        queryTerm: 'جستجو نهایی',
        searchMode: 'clubs',
      });
      assert.equal(rows.length, 5);
      assert.equal(rows[0].query_term, 'جستجو نهایی');
      throw new Error('ROLLBACK_SEARCH_TEST');
    }, pool).catch((err) => {
      if (!String(err.message).includes('ROLLBACK_SEARCH_TEST')) throw err;
    });

    // Management request atomic approval & single-approved-per-club invariant
    const pendingReqUuid = deterministicUuid('mgmt_request', 'mreq-103');
    const superAdminUuid = deterministicUuid('user', 'user-superadmin-1');
    await withTransaction(async (client) => {
      const approved = await approveManagementRequestTx(client, {
        requestId: pendingReqUuid,
        reviewerUserId: superAdminUuid,
      });
      assert.equal(approved.clubId, deterministicUuid('club', 'club-hashemieh-strike'));
      throw new Error('ROLLBACK_MGMT_TEST');
    }, pool).catch((err) => {
      if (!String(err.message).includes('ROLLBACK_MGMT_TEST')) throw err;
    });

    // Broadcast notification isolation per user
    const notif1Uuid = deterministicUuid('notification', 'notif-1');
    await withTransaction(async (client) => {
      const before = await listNotificationsForUser(client, memberUuid);
      assert.ok(before.some((n) => n.id === notif1Uuid && n.is_broadcast === true));
      await markNotificationReadTx(client, { notificationId: notif1Uuid, userId: memberUuid });
      await deleteNotificationForUserTx(client, { notificationId: notif1Uuid, userId: memberUuid });
      const afterMember = await listNotificationsForUser(client, memberUuid);
      assert.equal(afterMember.some((n) => n.id === notif1Uuid), false);

      const managerUuid = deterministicUuid('user', 'user-manager-1');
      const afterManager = await listNotificationsForUser(client, managerUuid);
      assert.ok(afterManager.some((n) => n.id === notif1Uuid && n.is_read === false));
      throw new Error('ROLLBACK_NOTIF_TEST');
    }, pool).catch((err) => {
      if (!String(err.message).includes('ROLLBACK_NOTIF_TEST')) throw err;
    });

    // Full rollback & re-migration check
    const rolledBack = await migrateDown(pool, 4);
    assert.equal(rolledBack.length, 4);
    const remainingTables = await pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`
    );
    assert.equal(remainingTables.rows.length, 0);

    const reapplied = await migrateUp(pool);
    assert.equal(reapplied.length, 4);
  } finally {
    await closeDbPool(pool);
  }
});
