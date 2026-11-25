/**
 * SPORTLINK — Idempotent Catalog Seeder (Production-Safe Reference Data)
 * Sources exact Mashhad neighborhoods, club types, facilities, categories, and 35 sports from js/data.js.
 */

import type { Pool, PoolClient } from 'pg';
import {
  MASHHAD_NEIGHBORHOODS,
  CLUB_TYPES,
  FACILITIES,
  CATEGORIES,
  SPORTS,
} from '../../js/data.js';
import { withTransaction } from '../pool.js';

const NEIGHBORHOOD_SLUGS: Record<string, string> = {
  سجاد: 'sajjad',
  'وکیل‌آباد': 'vakilabad',
  'احمدآباد': 'ahmadabad',
  هاشمیه: 'hashemieh',
  کوهسنگی: 'koohsangi',
  معلم: 'moalem',
  الهیه: 'elahieh',
  'ملک‌آباد': 'malekabad',
};

const CLUB_TYPE_SLUGS: Record<string, string> = {
  'مجموعه چندمنظوره': 'multipurpose-complex',
  'باشگاه بدنسازی': 'bodybuilding-gym',
  'مجموعه آبی': 'aquatics-complex',
  'آکادمی رزمی': 'martial-arts-academy',
  'باشگاه راکتی': 'racket-club',
  'استودیو تخصصی': 'specialty-studio',
};

export async function seedCatalogWithClient(client: PoolClient): Promise<{
  cityId: number;
  neighborhoodIdsByName: Map<string, number>;
  clubTypeIdsByName: Map<string, number>;
}> {
  // 1. City: Mashhad
  const cityRes = await client.query<{ id: number }>(
    `INSERT INTO cities (name, slug, is_active)
     VALUES ($1, $2, TRUE)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE
     RETURNING id`,
    ['مشهد', 'mashhad']
  );
  const cityId = cityRes.rows[0].id;

  // 2. Mashhad Neighborhoods (8)
  const neighborhoodIdsByName = new Map<string, number>();
  for (let i = 0; i < MASHHAD_NEIGHBORHOODS.length; i += 1) {
    const name = MASHHAD_NEIGHBORHOODS[i];
    const slug = NEIGHBORHOOD_SLUGS[name] || `neighborhood-${i + 1}`;
    const res = await client.query<{ id: number }>(
      `INSERT INTO neighborhoods (city_id, name, slug, display_order, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (city_id, slug) DO UPDATE
         SET name = EXCLUDED.name, display_order = EXCLUDED.display_order, is_active = TRUE
       RETURNING id`,
      [cityId, name, slug, i + 1]
    );
    neighborhoodIdsByName.set(name, res.rows[0].id);
  }

  // 3. Club Types (6)
  const clubTypeIdsByName = new Map<string, number>();
  for (let i = 0; i < CLUB_TYPES.length; i += 1) {
    const name = CLUB_TYPES[i];
    const slug = CLUB_TYPE_SLUGS[name] || `club-type-${i + 1}`;
    const res = await client.query<{ id: number }>(
      `INSERT INTO club_types (name, slug, display_order, is_active)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (slug) DO UPDATE
         SET name = EXCLUDED.name, display_order = EXCLUDED.display_order, is_active = TRUE
       RETURNING id`,
      [name, slug, i + 1]
    );
    clubTypeIdsByName.set(name, res.rows[0].id);
  }

  // 4. Sports Categories (7)
  for (let i = 0; i < CATEGORIES.length; i += 1) {
    const cat = CATEGORIES[i];
    await client.query(
      `INSERT INTO sports_categories (id, name, slug, description, image_url, display_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             slug = EXCLUDED.slug,
             description = EXCLUDED.description,
             image_url = EXCLUDED.image_url,
             display_order = EXCLUDED.display_order,
             is_active = TRUE`,
      [cat.id, cat.name, cat.slug, cat.description || '', cat.image || '', i + 1]
    );
  }

  // 5. Sports (35)
  for (const sport of SPORTS) {
    await client.query(
      `INSERT INTO sports (id, category_id, name, short_summary, description, image_url, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       ON CONFLICT (id) DO UPDATE
         SET category_id = EXCLUDED.category_id,
             name = EXCLUDED.name,
             short_summary = EXCLUDED.short_summary,
             description = EXCLUDED.description,
             image_url = EXCLUDED.image_url,
             is_active = TRUE`,
      [
        sport.id,
        sport.categoryId,
        sport.name,
        sport.shortSummary,
        sport.description || '',
        sport.image || '',
      ]
    );
  }

  // 6. Standard Facilities (10)
  for (let i = 0; i < FACILITIES.length; i += 1) {
    const fac = FACILITIES[i];
    await client.query(
      `INSERT INTO facilities (id, name, is_standard, display_order, is_active)
       VALUES ($1, $2, TRUE, $3, TRUE)
       ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             is_standard = TRUE,
             display_order = EXCLUDED.display_order,
             is_active = TRUE`,
      [fac.id, fac.name, i + 1]
    );
  }

  // 7. Singleton Platform Settings (id = 1)
  await client.query(
    `INSERT INTO platform_settings (
       id, site_notice, allow_club_registration, session_timeout_minutes, notification_sound_enabled
     )
     VALUES (1, $1, TRUE, 30, FALSE)
     ON CONFLICT (id) DO NOTHING`,
    ['نسخه آزمایشی SPORTLINK مشهد — اطلاعات مجموعه‌ها نمونه است.']
  );

  return { cityId, neighborhoodIdsByName, clubTypeIdsByName };
}

export async function seedCatalog(pool?: Pool): Promise<void> {
  await withTransaction(async (client) => {
    await seedCatalogWithClient(client);
  }, pool);
}
