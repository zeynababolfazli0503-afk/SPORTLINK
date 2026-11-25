-- SPORTLINK Migration 003 (DOWN): Rollback tables 17 down to 9

DROP TRIGGER IF EXISTS trg_club_daily_metrics_set_updated_at ON club_daily_metrics;
DROP TABLE IF EXISTS club_daily_metrics;
DROP TABLE IF EXISTS club_operating_hours;
DROP TABLE IF EXISTS club_images;
DROP TABLE IF EXISTS club_facilities;
DROP TABLE IF EXISTS club_sports;

DROP TRIGGER IF EXISTS trg_clubs_set_updated_at ON clubs;
DROP TABLE IF EXISTS clubs;
DROP TABLE IF EXISTS facilities;

DROP TRIGGER IF EXISTS trg_sports_set_updated_at ON sports;
DROP TABLE IF EXISTS sports;
DROP TABLE IF EXISTS sports_categories;
