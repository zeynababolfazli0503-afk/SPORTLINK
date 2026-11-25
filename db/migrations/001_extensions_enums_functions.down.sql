-- SPORTLINK Migration 001 (DOWN): Rollback domain ENUM types and trigger functions

DROP TYPE IF EXISTS notification_type;
DROP TYPE IF EXISTS report_status;
DROP TYPE IF EXISTS report_category;
DROP TYPE IF EXISTS club_edit_type;
DROP TYPE IF EXISTS change_request_status;
DROP TYPE IF EXISTS management_request_status;
DROP TYPE IF EXISTS search_mode;
DROP TYPE IF EXISTS week_day;
DROP TYPE IF EXISTS club_status;
DROP TYPE IF EXISTS otp_purpose;
DROP TYPE IF EXISTS admin_permission_key;
DROP TYPE IF EXISTS user_role;

DROP FUNCTION IF EXISTS set_updated_at();
