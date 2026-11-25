-- SPORTLINK Migration 002 (UP): Geography, club types, stored files, users, RBAC, sessions, and OTPs
-- Tables (1-8): cities, neighborhoods, club_types, stored_files, users, sub_admin_permissions, user_sessions, otp_verifications

-- 1. cities
CREATE TABLE cities (
  id SMALLSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. neighborhoods
CREATE TABLE neighborhoods (
  id SMALLSERIAL PRIMARY KEY,
  city_id SMALLINT NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  display_order SMALLINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_neighborhoods_city_name UNIQUE (city_id, name),
  CONSTRAINT uq_neighborhoods_city_slug UNIQUE (city_id, slug),
  -- Supports composite FK (city_id, neighborhood_id) from clubs
  CONSTRAINT uq_neighborhoods_city_id UNIQUE (city_id, id)
);

CREATE INDEX idx_neighborhoods_city_active ON neighborhoods (city_id, display_order) WHERE is_active = TRUE;

-- 3. club_types
CREATE TABLE club_types (
  id SMALLSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  display_order SMALLINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 4. stored_files (metadata only; binary blobs live in private object storage)
CREATE TABLE stored_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  purpose TEXT NOT NULL CHECK (purpose IN ('management_document', 'report_evidence', 'avatar', 'club_image')),
  uploaded_by_user_id UUID NULL,
  is_private BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(50) NOT NULL CHECK (char_length(trim(first_name)) >= 2),
  last_name VARCHAR(50) NOT NULL CHECK (char_length(trim(last_name)) >= 2),
  email TEXT NULL,
  mobile VARCHAR(11) NOT NULL CHECK (mobile ~ '^09[0-9]{9}$'),
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  city_id SMALLINT NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
  bio VARCHAR(500) NOT NULL DEFAULT '',
  avatar_file_id UUID NULL REFERENCES stored_files(id) ON DELETE SET NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  notification_sound_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- Partial unique indexes allow re-registration after soft deletion (deleted_at IS NOT NULL)
CREATE UNIQUE INDEX uq_users_email_active
  ON users (LOWER(email))
  WHERE email IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_users_mobile_active
  ON users (mobile)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_users_role_active
  ON users (role, is_active)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE stored_files
  ADD CONSTRAINT fk_stored_files_uploaded_by_user
  FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_stored_files_uploader ON stored_files (uploaded_by_user_id, created_at DESC);

-- 6. sub_admin_permissions
CREATE TABLE sub_admin_permissions (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_key admin_permission_key NOT NULL,
  granted_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, permission_key)
);

-- 7. user_sessions
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT NOT NULL DEFAULT '',
  ip_address INET NULL,
  login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  CONSTRAINT chk_user_sessions_expiry CHECK (expires_at >= login_at)
);

CREATE INDEX idx_user_sessions_user_active
  ON user_sessions (user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

-- 8. otp_verifications
CREATE TABLE otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES users(id) ON DELETE CASCADE,
  mobile VARCHAR(11) NOT NULL CHECK (mobile ~ '^09[0-9]{9}$'),
  purpose otp_purpose NOT NULL,
  code_hash TEXT NOT NULL,
  attempt_count SMALLINT NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts SMALLINT NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_otp_attempts_bound CHECK (attempt_count <= max_attempts)
);

CREATE INDEX idx_otp_mobile_purpose_active
  ON otp_verifications (mobile, purpose, created_at DESC)
  WHERE verified_at IS NULL;
