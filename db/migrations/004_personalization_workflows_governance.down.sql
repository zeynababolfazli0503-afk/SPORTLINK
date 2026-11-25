-- SPORTLINK Migration 004 (DOWN): Rollback tables 30 down to 18

DROP TRIGGER IF EXISTS trg_platform_settings_set_updated_at ON platform_settings;
DROP TABLE IF EXISTS platform_settings;

DROP TABLE IF EXISTS admin_activity_logs;
DROP TABLE IF EXISTS notification_user_states;
DROP TABLE IF EXISTS notifications;

DROP TRIGGER IF EXISTS trg_contact_messages_set_updated_at ON contact_messages;
DROP TABLE IF EXISTS contact_messages;

DROP TRIGGER IF EXISTS trg_club_reports_set_updated_at ON club_reports;
DROP TABLE IF EXISTS club_reports;

DROP TABLE IF EXISTS club_edit_history;

DROP TRIGGER IF EXISTS trg_club_change_requests_set_updated_at ON club_change_requests;
DROP TABLE IF EXISTS club_change_requests;

DROP TRIGGER IF EXISTS trg_club_management_requests_set_updated_at ON club_management_requests;
DROP TABLE IF EXISTS club_management_requests;

DROP TABLE IF EXISTS user_search_history;

DROP TRIGGER IF EXISTS trg_user_comparisons_set_updated_at ON user_comparisons;
DROP TABLE IF EXISTS user_comparisons;

DROP TABLE IF EXISTS user_favorite_sports;
DROP TABLE IF EXISTS user_favorite_clubs;
