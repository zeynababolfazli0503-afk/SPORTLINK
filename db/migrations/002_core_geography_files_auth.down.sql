-- SPORTLINK Migration 002 (DOWN): Rollback tables 8 down to 1

DROP TABLE IF EXISTS otp_verifications;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS sub_admin_permissions;

ALTER TABLE IF EXISTS stored_files
  DROP CONSTRAINT IF EXISTS fk_stored_files_uploaded_by_user;

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON users;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS stored_files;
DROP TABLE IF EXISTS club_types;
DROP TABLE IF EXISTS neighborhoods;
DROP TABLE IF EXISTS cities;
