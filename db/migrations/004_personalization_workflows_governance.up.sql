-- SPORTLINK Migration 004 (UP): Personalization, governance workflows, notifications, audit logs, and platform settings
-- Tables (18-30): user_favorite_clubs, user_favorite_sports, user_comparisons, user_search_history,
-- club_management_requests, club_change_requests, club_edit_history, club_reports,
-- contact_messages, notifications, notification_user_states, admin_activity_logs, platform_settings

-- 18. user_favorite_clubs
CREATE TABLE user_favorite_clubs (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, club_id)
);

CREATE INDEX idx_user_favorite_clubs_user ON user_favorite_clubs (user_id, created_at DESC);

-- 19. user_favorite_sports
CREATE TABLE user_favorite_sports (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport_id VARCHAR(64) NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, sport_id)
);

CREATE INDEX idx_user_favorite_sports_user ON user_favorite_sports (user_id, created_at DESC);

-- 20. user_comparisons (Max 2 slots per user)
CREATE TABLE user_comparisons (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_index SMALLINT NOT NULL CHECK (slot_index IN (1, 2)),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, slot_index),
  CONSTRAINT uq_user_comparisons_club UNIQUE (user_id, club_id)
);

CREATE TRIGGER trg_user_comparisons_set_updated_at
  BEFORE UPDATE ON user_comparisons
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 21. user_search_history (Max 5 recent terms per user maintained transactionally)
CREATE TABLE user_search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query_term VARCHAR(120) NOT NULL CHECK (char_length(trim(query_term)) > 0),
  search_mode search_mode NOT NULL DEFAULT 'clubs',
  searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_search_history_term UNIQUE (user_id, query_term, search_mode)
);

CREATE INDEX idx_user_search_history_user_recent ON user_search_history (user_id, searched_at DESC);

-- 22. club_management_requests
CREATE TABLE club_management_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id UUID NULL REFERENCES clubs(id) ON DELETE SET NULL,
  applicant_first_name VARCHAR(50) NOT NULL,
  applicant_last_name VARCHAR(50) NOT NULL,
  applicant_mobile VARCHAR(11) NOT NULL CHECK (applicant_mobile ~ '^09[0-9]{9}$'),
  requested_club_name VARCHAR(120) NOT NULL,
  document_file_id UUID NULL REFERENCES stored_files(id) ON DELETE SET NULL,
  document_name VARCHAR(255) NOT NULL DEFAULT '',
  status management_request_status NOT NULL DEFAULT 'pending',
  review_reason TEXT NOT NULL DEFAULT '',
  reviewed_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At most one approved management request per club
CREATE UNIQUE INDEX uq_mgmt_req_one_approved_per_club
  ON club_management_requests (club_id)
  WHERE status = 'approved' AND club_id IS NOT NULL;

CREATE UNIQUE INDEX uq_mgmt_req_active_per_user_club
  ON club_management_requests (user_id, club_id)
  WHERE status IN ('pending', 'needs_revision') AND club_id IS NOT NULL;

CREATE INDEX idx_mgmt_req_user_submitted ON club_management_requests (user_id, submitted_at DESC);
CREATE INDEX idx_mgmt_req_status ON club_management_requests (status, submitted_at DESC);

CREATE TRIGGER trg_club_management_requests_set_updated_at
  BEFORE UPDATE ON club_management_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 23. club_change_requests
CREATE TABLE club_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  requested_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL CHECK (field_key IN ('name', 'fullAddress', 'phone', 'priceInfo', 'customFacility')),
  field_label VARCHAR(100) NOT NULL,
  old_value_text TEXT NOT NULL DEFAULT '',
  new_value_text TEXT NOT NULL,
  proposed_payload JSONB NULL,
  status change_request_status NOT NULL DEFAULT 'pending',
  review_reason TEXT NOT NULL DEFAULT '',
  reviewed_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_change_req_club_status ON club_change_requests (club_id, status, submitted_at DESC);

CREATE TRIGGER trg_club_change_requests_set_updated_at
  BEFORE UPDATE ON club_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 24. club_edit_history
CREATE TABLE club_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  actor_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  edit_type club_edit_type NOT NULL,
  detail VARCHAR(300) NOT NULL,
  related_change_request_id UUID NULL REFERENCES club_change_requests(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_club_edit_history_club_recent ON club_edit_history (club_id, created_at DESC);

-- 25. club_reports
CREATE TABLE club_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  reporter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category report_category NOT NULL,
  description VARCHAR(800) NOT NULL CHECK (char_length(trim(description)) >= 10),
  evidence_file_id UUID NULL REFERENCES stored_files(id) ON DELETE SET NULL,
  evidence_name VARCHAR(255) NOT NULL DEFAULT '',
  status report_status NOT NULL DEFAULT 'submitted',
  admin_reply TEXT NOT NULL DEFAULT '',
  reviewed_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_club_reports_reporter ON club_reports (reporter_user_id, submitted_at DESC);
CREATE INDEX idx_club_reports_status ON club_reports (status, submitted_at DESC);

CREATE TRIGGER trg_club_reports_set_updated_at
  BEFORE UPDATE ON club_reports
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 26. contact_messages
CREATE TABLE contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  sender_name VARCHAR(80) NOT NULL CHECK (char_length(trim(sender_name)) >= 2),
  sender_email TEXT NOT NULL,
  subject VARCHAR(120) NOT NULL CHECK (char_length(trim(subject)) >= 3),
  message VARCHAR(1000) NOT NULL CHECK (char_length(trim(message)) >= 10),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
  assigned_to_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contact_messages_status ON contact_messages (status, created_at DESC);

CREATE TRIGGER trg_contact_messages_set_updated_at
  BEFORE UPDATE ON contact_messages
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 27. notifications (recipient_user_id NULL = broadcast announcement)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  target_link TEXT NOT NULL DEFAULT '/pages/notifications.html',
  created_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient_created ON notifications (recipient_user_id, created_at DESC);
CREATE INDEX idx_notifications_broadcast_created ON notifications (created_at DESC) WHERE recipient_user_id IS NULL;

-- 28. notification_user_states (per-user read & deletion tracking, incl. broadcasts)
CREATE TABLE notification_user_states (
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ NULL,
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX idx_notification_user_states_user_unread
  ON notification_user_states (user_id, is_read, is_deleted);

-- 29. admin_activity_logs
CREATE TABLE admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  actor_display_name VARCHAR(120) NOT NULL,
  action TEXT NOT NULL,
  target_type VARCHAR(60) NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_activity_logs_created ON admin_activity_logs (created_at DESC);

-- 30. platform_settings (singleton id = 1)
CREATE TABLE platform_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  site_notice VARCHAR(500) NOT NULL,
  allow_club_registration BOOLEAN NOT NULL DEFAULT TRUE,
  session_timeout_minutes SMALLINT NOT NULL DEFAULT 30 CHECK (session_timeout_minutes BETWEEN 5 AND 1440),
  notification_sound_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_platform_settings_set_updated_at
  BEFORE UPDATE ON platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
