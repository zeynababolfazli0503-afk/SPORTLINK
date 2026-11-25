-- SPORTLINK Migration 001 (UP): Extensions, trigger helper functions, and domain ENUM types
-- Target: PostgreSQL 15+ (UTF-8, Asia/Tehran)

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Automatic updated_at maintenance trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Domain ENUM types (12 MVP enums)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('user', 'manager', 'sub_admin', 'super_admin');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_permission_key') THEN
    CREATE TYPE admin_permission_key AS ENUM (
      'users',
      'clubs',
      'sports',
      'changes',
      'reports',
      'announcements',
      'analytics',
      'settings',
      'activity_log',
      'all'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'otp_purpose') THEN
    CREATE TYPE otp_purpose AS ENUM ('register', 'login', 'reset_password', 'verify_mobile');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'club_status') THEN
    CREATE TYPE club_status AS ENUM ('pending', 'published', 'rejected', 'archived');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'week_day') THEN
    CREATE TYPE week_day AS ENUM ('sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'search_mode') THEN
    CREATE TYPE search_mode AS ENUM ('clubs', 'sports', 'all');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'management_request_status') THEN
    CREATE TYPE management_request_status AS ENUM ('pending', 'needs_revision', 'approved', 'rejected');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'change_request_status') THEN
    CREATE TYPE change_request_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'club_edit_type') THEN
    CREATE TYPE club_edit_type AS ENUM ('instant', 'approval_required');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_category') THEN
    CREATE TYPE report_category AS ENUM ('invalid_info', 'invalid_phone', 'closed_club', 'violation', 'other');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE report_status AS ENUM ('submitted', 'in_review', 'needs_more_info', 'resolved', 'rejected');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE notification_type AS ENUM (
      'system',
      'management_request_status',
      'report_status',
      'club_registration_status',
      'official_announcement'
    );
  END IF;
END
$$;
