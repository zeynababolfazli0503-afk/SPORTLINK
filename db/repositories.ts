/**
 * SPORTLINK — Transactional PostgreSQL Repository Helpers
 * Enforces concurrency-safe business invariants:
 * 1) Atomic club management approval (FOR UPDATE + single approved manager constraint)
 * 2) Concurrency-safe 5-item user search history cap (pg_advisory_xact_lock)
 * 3) Per-user + broadcast notification isolation
 */

import type { PoolClient } from 'pg';

export async function approveManagementRequestTx(
  client: PoolClient,
  params: { requestId: string; reviewerUserId: string }
): Promise<{ clubId: string; userId: string }> {
  const reqRes = await client.query<{
    id: string;
    user_id: string;
    club_id: string | null;
    status: string;
  }>(
    `SELECT id, user_id, club_id, status
     FROM club_management_requests
     WHERE id = $1
     FOR UPDATE`,
    [params.requestId]
  );

  const req = reqRes.rows[0];
  if (!req) {
    throw new Error('Management request not found.');
  }
  if (!req.club_id) {
    throw new Error('Management request must reference a target club before approval.');
  }
  if (req.status === 'approved') {
    return { clubId: req.club_id, userId: req.user_id };
  }

  // Lock target club row to prevent concurrent manager assignment races
  const clubRes = await client.query<{ id: string; manager_user_id: string | null }>(
    `SELECT id, manager_user_id
     FROM clubs
     WHERE id = $1 AND deleted_at IS NULL
     FOR UPDATE`,
    [req.club_id]
  );
  const club = clubRes.rows[0];
  if (!club) {
    throw new Error('Target club does not exist or has been deleted.');
  }
  if (club.manager_user_id && club.manager_user_id !== req.user_id) {
    throw new Error('Target club already has an assigned manager.');
  }

  await client.query(
    `UPDATE club_management_requests
     SET status = 'approved',
         review_reason = '',
         reviewed_by_user_id = $2,
         reviewed_at = NOW()
     WHERE id = $1`,
    [req.id, params.reviewerUserId]
  );

  await client.query(
    `UPDATE clubs
     SET manager_user_id = $2
     WHERE id = $1`,
    [req.club_id, req.user_id]
  );

  await client.query(
    `UPDATE users
     SET role = CASE WHEN role = 'user' THEN 'manager'::user_role ELSE role END
     WHERE id = $1 AND deleted_at IS NULL`,
    [req.user_id]
  );

  return { clubId: req.club_id, userId: req.user_id };
}

export async function recordSearchHistoryTx(
  client: PoolClient,
  params: { userId: string; queryTerm: string; searchMode: 'clubs' | 'sports' | 'all' }
): Promise<Array<{ id: string; query_term: string; search_mode: string; searched_at: Date }>> {
  const cleanTerm = params.queryTerm.trim();
  if (!cleanTerm) {
    throw new Error('Search query term must not be empty.');
  }

  // Serialize per-user history truncation so concurrent searches never exceed 5 rows
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [params.userId]);

  await client.query(
  `INSERT INTO user_search_history (user_id, query_term, search_mode, searched_at)
   VALUES ($1, $2, $3::search_mode, clock_timestamp())
   ON CONFLICT (user_id, query_term, search_mode) DO UPDATE
     SET searched_at = clock_timestamp()`,
  [params.userId, cleanTerm, params.searchMode]
);

  await client.query(
    `DELETE FROM user_search_history
     WHERE user_id = $1
       AND id IN (
         SELECT id
         FROM user_search_history
         WHERE user_id = $1
         ORDER BY searched_at DESC
         OFFSET 5
       )`,
    [params.userId]
  );

  const listRes = await client.query<{
    id: string;
    query_term: string;
    search_mode: string;
    searched_at: Date;
  }>(
    `SELECT id, query_term, search_mode, searched_at
     FROM user_search_history
     WHERE user_id = $1
     ORDER BY searched_at DESC
     LIMIT 5`,
    [params.userId]
  );

  return listRes.rows;
}

export async function listNotificationsForUser(
  client: PoolClient,
  userId: string
): Promise<
  Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    target_link: string;
    is_broadcast: boolean;
    is_read: boolean;
    created_at: Date;
  }>
> {
  const res = await client.query<{
    id: string;
    type: string;
    title: string;
    message: string;
    target_link: string;
    is_broadcast: boolean;
    is_read: boolean;
    created_at: Date;
  }>(
    `SELECT
       n.id,
       n.type::text AS type,
       n.title,
       n.message,
       n.target_link,
       (n.recipient_user_id IS NULL) AS is_broadcast,
       COALESCE(s.is_read, FALSE) AS is_read,
       n.created_at
     FROM notifications n
     LEFT JOIN notification_user_states s
       ON s.notification_id = n.id
      AND s.user_id = $1
     WHERE (n.recipient_user_id IS NULL OR n.recipient_user_id = $1)
       AND COALESCE(s.is_deleted, FALSE) = FALSE
     ORDER BY n.created_at DESC`,
    [userId]
  );
  return res.rows;
}

export async function markNotificationReadTx(
  client: PoolClient,
  params: { notificationId: string; userId: string }
): Promise<void> {
  await client.query(
    `INSERT INTO notification_user_states (notification_id, user_id, is_read, read_at, is_deleted)
     SELECT n.id, $2, TRUE, NOW(), FALSE
     FROM notifications n
     WHERE n.id = $1
       AND (n.recipient_user_id IS NULL OR n.recipient_user_id = $2)
     ON CONFLICT (notification_id, user_id) DO UPDATE
       SET is_read = TRUE,
           read_at = COALESCE(notification_user_states.read_at, NOW())`,
    [params.notificationId, params.userId]
  );
}

export async function deleteNotificationForUserTx(
  client: PoolClient,
  params: { notificationId: string; userId: string }
): Promise<void> {
  await client.query(
    `INSERT INTO notification_user_states (notification_id, user_id, is_read, is_deleted, deleted_at)
     SELECT n.id, $2, TRUE, TRUE, NOW()
     FROM notifications n
     WHERE n.id = $1
       AND (n.recipient_user_id IS NULL OR n.recipient_user_id = $2)
     ON CONFLICT (notification_id, user_id) DO UPDATE
       SET is_deleted = TRUE,
           deleted_at = NOW()`,
    [params.notificationId, params.userId]
  );
}
