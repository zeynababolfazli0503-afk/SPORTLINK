-- SPORTLINK Migration 003 (UP): Sports catalog, facilities, clubs directory, operating hours, and daily metrics
-- Tables (9-17): sports_categories, sports, facilities, clubs, club_sports, club_facilities, club_images, club_operating_hours, club_daily_metrics

-- 9. sports_categories
CREATE TABLE sports_categories (
  id VARCHAR(50) PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  display_order SMALLINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 10. sports
CREATE TABLE sports (
  id VARCHAR(64) PRIMARY KEY,
  category_id VARCHAR(50) NOT NULL REFERENCES sports_categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL UNIQUE,
  short_summary TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sports_category_active ON sports (category_id, is_active);

CREATE TRIGGER trg_sports_set_updated_at
  BEFORE UPDATE ON sports
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 11. facilities
CREATE TABLE facilities (
  id VARCHAR(64) PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_standard BOOLEAN NOT NULL DEFAULT TRUE,
  display_order SMALLINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 12. clubs
CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_key TEXT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL CHECK (char_length(trim(name)) >= 2),
  club_type_id SMALLINT NOT NULL REFERENCES club_types(id) ON DELETE RESTRICT,
  city_id SMALLINT NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
  neighborhood_id SMALLINT NOT NULL,
  short_address VARCHAR(200) NOT NULL,
  full_address VARCHAR(300) NOT NULL,
  location_hint VARCHAR(250) NOT NULL DEFAULT '',
  short_description VARCHAR(300) NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  has_price BOOLEAN NOT NULL DEFAULT FALSE,
  price_min_toman NUMERIC(14, 0) NULL,
  price_max_toman NUMERIC(14, 0) NULL,
  price_label TEXT NOT NULL DEFAULT 'استعلام قیمت',
  phone VARCHAR(40) NOT NULL,
  website_url TEXT NOT NULL DEFAULT '',
  instagram_handle VARCHAR(100) NOT NULL DEFAULT '',
  telegram_handle VARCHAR(100) NOT NULL DEFAULT '',
  manager_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  submitted_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  status club_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT NOT NULL DEFAULT '',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  views_count BIGINT NOT NULL DEFAULT 0 CHECK (views_count >= 0),
  search_impressions BIGINT NOT NULL DEFAULT 0 CHECK (search_impressions >= 0),
  phone_clicks BIGINT NOT NULL DEFAULT 0 CHECK (phone_clicks >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL,
  -- Guarantees every club's neighborhood belongs to the club's city
  CONSTRAINT fk_clubs_city_neighborhood
    FOREIGN KEY (city_id, neighborhood_id)
    REFERENCES neighborhoods(city_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_clubs_price_logic CHECK (
    (has_price = FALSE AND price_min_toman IS NULL AND price_max_toman IS NULL)
    OR
    (has_price = TRUE AND price_min_toman IS NOT NULL AND price_min_toman >= 0 AND (price_max_toman IS NULL OR price_max_toman >= price_min_toman))
  )
);

CREATE UNIQUE INDEX idx_clubs_manager_unique
  ON clubs (manager_user_id)
  WHERE manager_user_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_clubs_directory_filter
  ON clubs (status, city_id, neighborhood_id, club_type_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_clubs_featured
  ON clubs (is_featured, display_order DESC)
  WHERE status = 'published' AND deleted_at IS NULL;

CREATE INDEX idx_clubs_price_range
  ON clubs (has_price, price_min_toman, price_max_toman)
  WHERE status = 'published' AND deleted_at IS NULL;

CREATE INDEX idx_clubs_search_trgm
  ON clubs
  USING gin ((name || ' ' || short_address || ' ' || short_description) gin_trgm_ops);

CREATE TRIGGER trg_clubs_set_updated_at
  BEFORE UPDATE ON clubs
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 13. club_sports
CREATE TABLE club_sports (
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  sport_id VARCHAR(64) NOT NULL REFERENCES sports(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (club_id, sport_id)
);

CREATE INDEX idx_club_sports_sport_id ON club_sports (sport_id, club_id);

-- 14. club_facilities
CREATE TABLE club_facilities (
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  facility_id VARCHAR(64) NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (club_id, facility_id)
);

CREATE INDEX idx_club_facilities_facility_id ON club_facilities (facility_id, club_id);

-- 15. club_images
CREATE TABLE club_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  file_id UUID NULL REFERENCES stored_files(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  alt_text VARCHAR(200) NOT NULL DEFAULT '',
  sort_order SMALLINT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_club_images_club_sort ON club_images (club_id, sort_order ASC);

CREATE UNIQUE INDEX uq_club_images_one_primary
  ON club_images (club_id)
  WHERE is_primary = TRUE;

-- 16. club_operating_hours
CREATE TABLE club_operating_hours (
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  day_of_week week_day NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  open_time TIME NULL,
  close_time TIME NULL,
  note VARCHAR(250) NOT NULL DEFAULT '',
  PRIMARY KEY (club_id, day_of_week),
  CONSTRAINT chk_club_hours_valid CHECK (
    (is_closed = TRUE AND open_time IS NULL AND close_time IS NULL)
    OR
    (is_closed = FALSE AND open_time IS NOT NULL AND close_time IS NOT NULL AND close_time > open_time)
  )
);

-- 17. club_daily_metrics
CREATE TABLE club_daily_metrics (
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  views_count INTEGER NOT NULL DEFAULT 0 CHECK (views_count >= 0),
  search_impressions INTEGER NOT NULL DEFAULT 0 CHECK (search_impressions >= 0),
  phone_clicks INTEGER NOT NULL DEFAULT 0 CHECK (phone_clicks >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (club_id, metric_date)
);

CREATE TRIGGER trg_club_daily_metrics_set_updated_at
  BEFORE UPDATE ON club_daily_metrics
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
