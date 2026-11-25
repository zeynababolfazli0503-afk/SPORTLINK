/**
 * SPORTLINK — Idempotent Development & Demo Seeder
 * Populates sample clubs, demo accounts, requests, reports, notifications, metrics, and logs from js/data.js.
 */

import { randomBytes } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
  DEMO_USERS,
  INITIAL_CLUBS,
  INITIAL_MANAGEMENT_REQUESTS,
  INITIAL_CHANGE_REQUESTS,
  INITIAL_REPORTS,
  INITIAL_NOTIFICATIONS,
  INITIAL_ACTIVITY_LOGS,
  ANALYTICS_SERIES,
} from '../../js/data.js';
import { deterministicUuid, hashSeedPassword, normalizeScheduleTime } from '../ids.js';
import { withTransaction } from '../pool.js';
import { seedCatalogWithClient } from './seed-catalog.js';

const MGMT_STATUS_MAP: Record<string, string> = {
  'تأیید شده': 'approved',
  'نیازمند اصلاح': 'needs_revision',
  'در انتظار بررسی': 'pending',
  'رد شده': 'rejected',
};

const CHANGE_STATUS_MAP: Record<string, string> = {
  'تأیید شده': 'approved',
  'در انتظار بررسی': 'pending',
  'رد شده': 'rejected',
};

const REPORT_CATEGORY_MAP: Record<string, string> = {
  'اطلاعات نادرست': 'invalid_info',
  'شماره تماس نامعتبر': 'invalid_phone',
  'تعطیلی یا فعالیت نداشتن باشگاه': 'closed_club',
  تخلف: 'violation',
  'سایر موارد': 'other',
};

const REPORT_STATUS_MAP: Record<string, string> = {
  'ثبت‌شده': 'submitted',
  'در حال بررسی': 'in_review',
  'نیازمند اطلاعات بیشتر': 'needs_more_info',
  'رسیدگی‌شده': 'resolved',
  ردشده: 'rejected',
};

const NOTIFICATION_TYPE_MAP: Record<string, string> = {
  'اعلان‌های سیستمی': 'system',
  'تغییر وضعیت درخواست مدیریت': 'management_request_status',
  'تغییر وضعیت گزارش': 'report_status',
  'تغییر وضعیت درخواست ثبت باشگاه': 'club_registration_status',
  'اطلاعیه‌های رسمی SPORTLINK': 'official_announcement',
};

const WEEK_DAYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const;

export async function seedDevWithClient(client: PoolClient): Promise<void> {
  const { cityId, neighborhoodIdsByName, clubTypeIdsByName } = await seedCatalogWithClient(client);

  // Use env override if supplied for automated local tests, otherwise ephemeral random dev secret
  const devSeedSecret = process.env.SEED_DEV_PASSWORD || randomBytes(24).toString('hex');
  const demoPasswordHash = hashSeedPassword(devSeedSecret);

  const userUuidByLegacyId = new Map<string, string>();
  const clubUuidByLegacyId = new Map<string, string>();

  // 1. Demo Users (4)
  for (const user of DEMO_USERS) {
    const userUuid = deterministicUuid('user', user.id);
    userUuidByLegacyId.set(user.id, userUuid);

    await client.query(
      `INSERT INTO users (
         id, first_name, last_name, email, mobile, password_hash, role, city_id,
         bio, avatar_url, notification_sound_enabled, is_active, deleted_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::user_role, $8, $9, $10, FALSE, $11, NULL)
       ON CONFLICT (id) DO UPDATE
         SET first_name = EXCLUDED.first_name,
             last_name = EXCLUDED.last_name,
             email = EXCLUDED.email,
             mobile = EXCLUDED.mobile,
             role = EXCLUDED.role,
             city_id = EXCLUDED.city_id,
             bio = EXCLUDED.bio,
             avatar_url = EXCLUDED.avatar_url,
             is_active = EXCLUDED.is_active,
             deleted_at = NULL`,
      [
        userUuid,
        user.firstName,
        user.lastName,
        user.email,
        user.mobile,
        demoPasswordHash,
        user.role,
        cityId,
        user.bio || '',
        user.avatar || '',
        user.active !== false,
      ]
    );

    if (user.role === 'sub_admin' && Array.isArray(user.permissions)) {
      const grantorUuid = userUuidByLegacyId.get('user-superadmin-1') || null;
      for (const perm of user.permissions) {
        await client.query(
          `INSERT INTO sub_admin_permissions (user_id, permission_key, granted_by_user_id)
           VALUES ($1, $2::admin_permission_key, $3)
           ON CONFLICT (user_id, permission_key) DO NOTHING`,
          [userUuid, perm, grantorUuid]
        );
      }
    }
  }

  // Map managedClubId -> manager user UUID
  const managerByClubLegacyId = new Map<string, string>();
  for (const user of DEMO_USERS) {
    if (user.managedClubId) {
      const uid = userUuidByLegacyId.get(user.id);
      if (uid) managerByClubLegacyId.set(user.managedClubId, uid);
    }
  }

  // 2. Initial Clubs (16: 15 published + 1 pending)
  for (const club of INITIAL_CLUBS) {
    const clubUuid = deterministicUuid('club', club.id);
    clubUuidByLegacyId.set(club.id, clubUuid);

    const neighborhoodId = neighborhoodIdsByName.get(club.neighborhood);
    const clubTypeId = clubTypeIdsByName.get(club.type);
    if (!neighborhoodId || !clubTypeId) {
      throw new Error(`Missing catalog mapping for club ${club.id}`);
    }

    const managerUserId = managerByClubLegacyId.get(club.id) || null;
    const hasPrice = Boolean(club.priceInfo?.hasPrice);
    const priceMin = hasPrice && club.priceInfo?.minToman !== undefined ? club.priceInfo.minToman : null;
    const priceMax = hasPrice && club.priceInfo?.maxToman !== undefined ? club.priceInfo.maxToman : null;
    const priceLabel = club.priceInfo?.label || 'استعلام قیمت';

    await client.query(
      `INSERT INTO clubs (
         id, legacy_key, slug, name, club_type_id, city_id, neighborhood_id,
         short_address, full_address, location_hint, short_description, description,
         has_price, price_min_toman, price_max_toman, price_label,
         phone, website_url, instagram_handle, telegram_handle,
         manager_user_id, status, is_featured, display_order,
         views_count, search_impressions, phone_clicks,
         published_at, deleted_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12,
         $13, $14, $15, $16,
         $17, $18, $19, $20,
         $21, $22::club_status, $23, $24,
         $25, $26, $27,
         CASE WHEN $22::club_status = 'published' THEN NOW() ELSE NULL END,
         NULL
       )
       ON CONFLICT (id) DO UPDATE
         SET slug = EXCLUDED.slug,
             name = EXCLUDED.name,
             club_type_id = EXCLUDED.club_type_id,
             city_id = EXCLUDED.city_id,
             neighborhood_id = EXCLUDED.neighborhood_id,
             short_address = EXCLUDED.short_address,
             full_address = EXCLUDED.full_address,
             location_hint = EXCLUDED.location_hint,
             short_description = EXCLUDED.short_description,
             description = EXCLUDED.description,
             has_price = EXCLUDED.has_price,
             price_min_toman = EXCLUDED.price_min_toman,
             price_max_toman = EXCLUDED.price_max_toman,
             price_label = EXCLUDED.price_label,
             phone = EXCLUDED.phone,
             website_url = EXCLUDED.website_url,
             instagram_handle = EXCLUDED.instagram_handle,
             telegram_handle = EXCLUDED.telegram_handle,
             manager_user_id = EXCLUDED.manager_user_id,
             status = EXCLUDED.status,
             is_featured = EXCLUDED.is_featured,
             display_order = EXCLUDED.display_order,
             views_count = EXCLUDED.views_count,
             search_impressions = EXCLUDED.search_impressions,
             phone_clicks = EXCLUDED.phone_clicks,
             deleted_at = NULL`,
      [
        clubUuid,
        club.id,
        club.slug,
        club.name,
        clubTypeId,
        cityId,
        neighborhoodId,
        club.shortAddress,
        club.fullAddress,
        club.locationHint || '',
        club.shortDescription || '',
        club.description || '',
        hasPrice,
        priceMin,
        priceMax,
        priceLabel,
        club.phone,
        club.website || '',
        club.social?.instagram || '',
        club.social?.telegram || '',
        managerUserId,
        club.status,
        Boolean(club.isFeatured),
        club.createdAtOrder ?? 0,
        club.viewsCount ?? 0,
        club.searchImpressions ?? 0,
        club.phoneClicks ?? 0,
      ]
    );

    // 2a. Club sports
    for (const sportId of club.sports || []) {
      await client.query(
        `INSERT INTO club_sports (club_id, sport_id)
         VALUES ($1, $2)
         ON CONFLICT (club_id, sport_id) DO NOTHING`,
        [clubUuid, sportId]
      );
    }

    // 2b. Club facilities
    for (const facilityId of club.facilities || []) {
      await client.query(
        `INSERT INTO club_facilities (club_id, facility_id)
         VALUES ($1, $2)
         ON CONFLICT (club_id, facility_id) DO NOTHING`,
        [clubUuid, facilityId]
      );
    }

    // 2c. Club images (deterministic UUID per (clubId, index))
    const images = club.images || [];
    for (let idx = 0; idx < images.length; idx += 1) {
      const imageUuid = deterministicUuid('club_image', `${club.id}:${idx}`);
      await client.query(
        `INSERT INTO club_images (id, club_id, image_url, alt_text, sort_order, is_primary)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE
           SET image_url = EXCLUDED.image_url,
               alt_text = EXCLUDED.alt_text,
               sort_order = EXCLUDED.sort_order,
               is_primary = EXCLUDED.is_primary`,
        [imageUuid, clubUuid, images[idx], `${club.name} - تصویر ${idx + 1}`, idx, idx === 0]
      );
    }

    // 2d. Club operating hours (7 days)
    const hours = club.hours as Record<string, { open?: string; close?: string; note?: string }> | undefined;
    for (const day of WEEK_DAYS) {
      const slot = hours?.[day];
      const openTime = normalizeScheduleTime(slot?.open);
      const closeTime = normalizeScheduleTime(slot?.close);
      const isClosed = !openTime || !closeTime;
      await client.query(
        `INSERT INTO club_operating_hours (club_id, day_of_week, is_closed, open_time, close_time, note)
         VALUES ($1, $2::week_day, $3, $4::time, $5::time, $6)
         ON CONFLICT (club_id, day_of_week) DO UPDATE
           SET is_closed = EXCLUDED.is_closed,
               open_time = EXCLUDED.open_time,
               close_time = EXCLUDED.close_time,
               note = EXCLUDED.note`,
        [
          clubUuid,
          day,
          isClosed,
          isClosed ? null : openTime,
          isClosed ? null : closeTime,
          slot?.note || '',
        ]
      );
    }
  }

  // 3. Sample daily metrics for club-sajjad-arena (ANALYTICS_SERIES.daily)
  const sajjadUuid = clubUuidByLegacyId.get('club-sajjad-arena');
  if (sajjadUuid) {
    for (let i = 0; i < ANALYTICS_SERIES.daily.length; i += 1) {
      const pt = ANALYTICS_SERIES.daily[i];
      await client.query(
        `INSERT INTO club_daily_metrics (club_id, metric_date, views_count, search_impressions, phone_clicks)
         VALUES ($1, (CURRENT_DATE - $2::integer), $3, $4, $5)
         ON CONFLICT (club_id, metric_date) DO UPDATE
           SET views_count = EXCLUDED.views_count,
               search_impressions = EXCLUDED.search_impressions,
               phone_clicks = EXCLUDED.phone_clicks`,
        [sajjadUuid, ANALYTICS_SERIES.daily.length - 1 - i, pt.views, pt.views * 3, pt.phoneClicks]
      );
    }
  }

  // 4. Club Management Requests (3)
  const superAdminUuid = userUuidByLegacyId.get('user-superadmin-1') || null;
  for (const req of INITIAL_MANAGEMENT_REQUESTS) {
    const reqUuid = deterministicUuid('mgmt_request', req.id);
    const userUuid = userUuidByLegacyId.get(req.userId);
    const clubUuid = clubUuidByLegacyId.get(req.clubId) || null;
    if (!userUuid) continue;
    const status = MGMT_STATUS_MAP[req.status] || 'pending';

    await client.query(
      `INSERT INTO club_management_requests (
         id, user_id, club_id, applicant_first_name, applicant_last_name, applicant_mobile,
         requested_club_name, document_name, status, review_reason, reviewed_by_user_id, reviewed_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9::management_request_status, $10,
         CASE WHEN $9 IN ('approved', 'needs_revision', 'rejected') THEN $11::uuid ELSE NULL END,
         CASE WHEN $9 IN ('approved', 'needs_revision', 'rejected') THEN NOW() ELSE NULL END
       )
       ON CONFLICT (id) DO UPDATE
         SET status = EXCLUDED.status,
             review_reason = EXCLUDED.review_reason,
             requested_club_name = EXCLUDED.requested_club_name,
             document_name = EXCLUDED.document_name`,
      [
        reqUuid,
        userUuid,
        clubUuid,
        req.firstName,
        req.lastName,
        req.mobile,
        req.clubName,
        req.documentName || '',
        status,
        req.reason || '',
        superAdminUuid,
      ]
    );
  }

  // 5. Club Change Requests (2) & Sample Edit History
  const managerUuid = userUuidByLegacyId.get('user-manager-1');
  if (managerUuid) {
    for (const creq of INITIAL_CHANGE_REQUESTS) {
      const creqUuid = deterministicUuid('change_request', creq.id);
      const clubUuid = clubUuidByLegacyId.get(creq.clubId);
      if (!clubUuid) continue;
      const status = CHANGE_STATUS_MAP[creq.status] || 'pending';

      await client.query(
        `INSERT INTO club_change_requests (
           id, club_id, requested_by_user_id, field_key, field_label,
           old_value_text, new_value_text, status, reviewed_by_user_id, reviewed_at
         )
         VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8::change_request_status,
           CASE WHEN $8 IN ('approved', 'rejected') THEN $9::uuid ELSE NULL END,
           CASE WHEN $8 IN ('approved', 'rejected') THEN NOW() ELSE NULL END
         )
         ON CONFLICT (id) DO UPDATE
           SET status = EXCLUDED.status,
               new_value_text = EXCLUDED.new_value_text`,
        [
          creqUuid,
          clubUuid,
          managerUuid,
          creq.field,
          creq.fieldLabel,
          creq.oldValue || '',
          creq.newValue,
          status,
          superAdminUuid,
        ]
      );
    }

    if (sajjadUuid) {
      await client.query(
        `INSERT INTO club_edit_history (id, club_id, actor_user_id, edit_type, detail, related_change_request_id)
         VALUES
           ($1, $2, $3, 'instant', $4, NULL),
           ($5, $2, $3, 'approval_required', $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          deterministicUuid('edit_history', 'eh-1'),
          sajjadUuid,
          managerUuid,
          'به‌روزرسانی ساعات فعالیت روزهای پنج‌شنبه',
          deterministicUuid('edit_history', 'eh-2'),
          'ارسال درخواست تغییر تعرفه ماهانه به SPORTLINK',
          deterministicUuid('change_request', 'creq-201'),
        ]
      );
    }
  }

  // 6. Club Reports (2)
  const subAdminUuid = userUuidByLegacyId.get('user-subadmin-1') || null;
  for (const rep of INITIAL_REPORTS) {
    const repUuid = deterministicUuid('report', rep.id);
    const clubUuid = clubUuidByLegacyId.get(rep.clubId);
    const reporterUuid = userUuidByLegacyId.get(rep.userId);
    if (!clubUuid || !reporterUuid) continue;

    const category = REPORT_CATEGORY_MAP[rep.category] || 'other';
    const status = REPORT_STATUS_MAP[rep.status] || 'submitted';

    await client.query(
      `INSERT INTO club_reports (
         id, club_id, reporter_user_id, category, description, evidence_name,
         status, admin_reply, reviewed_by_user_id, reviewed_at
       )
       VALUES (
         $1, $2, $3, $4::report_category, $5, $6,
         $7::report_status, $8,
         CASE WHEN $7 IN ('in_review', 'needs_more_info', 'resolved', 'rejected') THEN $9::uuid ELSE NULL END,
         CASE WHEN $7 IN ('resolved', 'rejected') THEN NOW() ELSE NULL END
       )
       ON CONFLICT (id) DO UPDATE
         SET status = EXCLUDED.status,
             admin_reply = EXCLUDED.admin_reply`,
      [
        repUuid,
        clubUuid,
        reporterUuid,
        category,
        rep.description,
        rep.evidenceName || '',
        status,
        rep.adminReply || '',
        subAdminUuid,
      ]
    );
  }

  // 7. Notifications (4) + per-user initial read states
  for (const notif of INITIAL_NOTIFICATIONS) {
    const notifUuid = deterministicUuid('notification', notif.id);
    const recipientUuid = notif.userId ? userUuidByLegacyId.get(notif.userId) || null : null;
    const notifType = NOTIFICATION_TYPE_MAP[notif.type] || 'system';

    await client.query(
      `INSERT INTO notifications (id, recipient_user_id, type, title, message, target_link, created_by_user_id)
       VALUES ($1, $2, $3::notification_type, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE
         SET title = EXCLUDED.title,
             message = EXCLUDED.message,
             target_link = EXCLUDED.target_link`,
      [
        notifUuid,
        recipientUuid,
        notifType,
        notif.title,
        notif.message,
        notif.link || '/pages/notifications.html',
        superAdminUuid,
      ]
    );

    // Preserve initial read=true state for seeded user-member-1 notifications
    const stateOwnerUuid = recipientUuid || userUuidByLegacyId.get('user-member-1');
    if (stateOwnerUuid && notif.read) {
      await client.query(
        `INSERT INTO notification_user_states (notification_id, user_id, is_read, read_at, is_deleted)
         VALUES ($1, $2, TRUE, NOW(), FALSE)
         ON CONFLICT (notification_id, user_id) DO NOTHING`,
        [notifUuid, stateOwnerUuid]
      );
    }
  }

  // 8. Admin Activity Logs (2)
  for (const log of INITIAL_ACTIVITY_LOGS) {
    const logUuid = deterministicUuid('activity_log', log.id);
    const actorUuid = log.id === 'log-1' ? superAdminUuid : subAdminUuid;
    await client.query(
      `INSERT INTO admin_activity_logs (id, actor_user_id, actor_display_name, action, target_type, target_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [
        logUuid,
        actorUuid,
        log.actorName,
        log.action,
        log.target?.startsWith('rep-') ? 'club_report' : 'club_change_request',
        log.target || '',
      ]
    );
  }
}

export async function seedDev(pool?: Pool): Promise<void> {
  await withTransaction(async (client) => {
    await seedDevWithClient(client);
  }, pool);
}
