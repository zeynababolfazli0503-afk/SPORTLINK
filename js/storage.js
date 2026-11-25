/**
 * SPORTLINK — Storage Layer (LocalStorage abstraction)
 * Decoupled from UI so it can be replaced with REST API / PostgreSQL calls later.
 * Security rule: Never store passwords or raw credentials in LocalStorage.
 *
 * IMPORTANT: LocalStorage is plain client-side data and provides NO real
 * confidentiality or authorization. The per-user split below only prevents
 * accidental cross-account mixing in this frontend-only MVP. A production
 * release MUST enforce ownership and access control on the server.
 */

import {
  INITIAL_CLUBS,
  DEMO_USERS,
  INITIAL_MANAGEMENT_REQUESTS,
  INITIAL_CHANGE_REQUESTS,
  INITIAL_REPORTS,
  INITIAL_NOTIFICATIONS,
  INITIAL_ACTIVITY_LOGS,
  SPORTS,
} from './data.js';

const STORAGE_VERSION = 'v1';
const PREFIX = `sportlink_${STORAGE_VERSION}_`;

export const KEYS = {
  CLUBS: `${PREFIX}clubs`,
  SPORTS: `${PREFIX}sports`,
  USERS: `${PREFIX}users`,
  SESSION: `${PREFIX}session`,
  FAVORITES_GUEST: `${PREFIX}fav_guest`,
  FAVORITES_USER_PREFIX: `${PREFIX}fav_user_`,
  COMPARE: `${PREFIX}compare`,
  SEARCH_HISTORY: `${PREFIX}search_history`,
  MGMT_REQUESTS: `${PREFIX}mgmt_requests`,
  CHANGE_REQUESTS: `${PREFIX}change_requests`,
  REPORTS: `${PREFIX}reports`,
  NOTIFICATIONS: `${PREFIX}notifications`,
  // Per-user notification stores. The legacy global key above is kept only as a
  // migration source and as the log of public broadcast announcements.
  NOTIFICATIONS_USER_PREFIX: `${PREFIX}notifications_user_`,
  ACTIVITY_LOGS: `${PREFIX}activity_logs`,
  SETTINGS: `${PREFIX}settings`,
};

const SENSITIVE_USER_FIELDS = ['password', 'demoVerifier', 'token', 'accessToken', 'refreshToken', 'apiKey', 'secret'];

function safeStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

export function readJSON(key, fallback) {
  const store = safeStorage();
  if (!store) return structuredCloneFallback(fallback);
  try {
    const raw = store.getItem(key);
    if (raw === null) return structuredCloneFallback(fallback);
    return JSON.parse(raw);
  } catch {
    return structuredCloneFallback(fallback);
  }
}

export function writeJSON(key, value) {
  const store = safeStorage();
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key) {
  const store = safeStorage();
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    // ignore storage quota/access errors
  }
}

function structuredCloneFallback(val) {
  if (val === undefined) return undefined;
  return JSON.parse(JSON.stringify(val));
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readRecordList(key, fallback) {
  const value = readJSON(key, fallback);
  return Array.isArray(value) ? value.filter(isRecord) : structuredCloneFallback(fallback);
}

function writeRecordList(key, value) {
  if (!Array.isArray(value)) return false;
  return writeJSON(key, value.filter(isRecord));
}

function stripSensitiveUserFields(user) {
  const safeUser = { ...user };
  SENSITIVE_USER_FIELDS.forEach((field) => delete safeUser[field]);
  return safeUser;
}

// Domain Repository Functions (API-ready boundary)

export function getClubs() {
  return readRecordList(KEYS.CLUBS, INITIAL_CLUBS)
    .filter((club) => typeof club.id === 'string' && typeof club.name === 'string' && typeof club.city === 'string' && typeof club.status === 'string')
    .map((club) => ({
      ...club,
      sports: Array.isArray(club.sports) ? club.sports.filter((id) => typeof id === 'string') : [],
      facilities: Array.isArray(club.facilities) ? club.facilities.filter((id) => typeof id === 'string') : [],
      images: Array.isArray(club.images) ? club.images.filter((url) => typeof url === 'string') : [],
      hours: isRecord(club.hours) ? club.hours : {},
      priceInfo: isRecord(club.priceInfo) ? club.priceInfo : { hasPrice: false, label: 'استعلام قیمت' },
      social: isRecord(club.social) ? club.social : {},
    }));
}

export function saveClubs(clubs) {
  return writeRecordList(KEYS.CLUBS, clubs);
}

export function getPublishedClubs() {
  return getClubs().filter((c) => c.status === 'published' && c.city === 'مشهد');
}

export function getSportsList() {
  return readRecordList(KEYS.SPORTS, SPORTS).filter(
    (sport) => typeof sport.id === 'string' && typeof sport.name === 'string' && typeof sport.categoryId === 'string' && typeof sport.shortSummary === 'string'
  );
}

export function saveSportsList(list) {
  return writeRecordList(KEYS.SPORTS, list);
}

export function getUsers() {
  const users = readRecordList(KEYS.USERS, DEMO_USERS).filter(
    (user) => typeof user.id === 'string' && typeof user.role === 'string' && typeof user.firstName === 'string' && typeof user.lastName === 'string'
  );
  const safeUsers = users.map(stripSensitiveUserFields);
  if (safeUsers.some((user, index) => SENSITIVE_USER_FIELDS.some((field) => Object.hasOwn(users[index], field)))) {
    writeJSON(KEYS.USERS, safeUsers);
  }
  return safeUsers;
}

export function saveUsers(users) {
  if (!Array.isArray(users)) return false;
  const safeUsers = users
    .filter((user) => isRecord(user) && typeof user.id === 'string' && typeof user.role === 'string')
    .map(stripSensitiveUserFields);
  return writeJSON(KEYS.USERS, safeUsers);
}

export function getSession() {
  const session = readJSON(KEYS.SESSION, null);
  if (!isRecord(session) || typeof session.userId !== 'string' || !Number.isFinite(Number(session.expiresAt))) return null;
  return session;
}

export function saveSession(sessionObj) {
  if (!sessionObj) {
    removeKey(KEYS.SESSION);
    return true;
  }
  // Never store password fields
  const cleanSession = {
    userId: sessionObj.userId,
    role: sessionObj.role,
    loginAt: sessionObj.loginAt,
    lastActivityAt: sessionObj.lastActivityAt,
    expiresAt: sessionObj.expiresAt,
  };
  return writeJSON(KEYS.SESSION, cleanSession);
}

export function getManagementRequests() {
  return readRecordList(KEYS.MGMT_REQUESTS, INITIAL_MANAGEMENT_REQUESTS);
}

export function saveManagementRequests(list) {
  return writeRecordList(KEYS.MGMT_REQUESTS, list);
}

export function getChangeRequests() {
  return readRecordList(KEYS.CHANGE_REQUESTS, INITIAL_CHANGE_REQUESTS);
}

export function saveChangeRequests(list) {
  return writeRecordList(KEYS.CHANGE_REQUESTS, list);
}

export function getReports() {
  return readRecordList(KEYS.REPORTS, INITIAL_REPORTS);
}

export function saveReports(list) {
  return writeRecordList(KEYS.REPORTS, list);
}

function isNotificationRecord(value) {
  return isRecord(value) && typeof value.id === 'string' && typeof value.title === 'string' && typeof value.message === 'string';
}

export function getNotificationsList() {
  return readRecordList(KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS).filter(isNotificationRecord);
}

export function saveNotificationsList(list) {
  return writeRecordList(KEYS.NOTIFICATIONS, list);
}

/**
 * Returns the notification store owned by a single user.
 * When no personal store exists yet, records are migrated from the legacy global
 * store: only that user's own records and public broadcasts are copied. The
 * legacy store is never deleted or rewritten, so older data stays recoverable.
 */
export function getNotificationsListForUser(userId) {
  if (typeof userId !== 'string' || !userId) return [];
  const key = `${KEYS.NOTIFICATIONS_USER_PREFIX}${userId}`;
  const stored = readJSON(key, null);
  if (Array.isArray(stored)) {
    return stored.filter(isNotificationRecord);
  }

  const scoped = getNotificationsList().filter((n) => !n.userId || n.userId === userId);
  saveNotificationsListForUser(userId, scoped);
  return scoped;
}

export function saveNotificationsListForUser(userId, list) {
  if (typeof userId !== 'string' || !userId || !Array.isArray(list)) return false;
  return writeJSON(`${KEYS.NOTIFICATIONS_USER_PREFIX}${userId}`, list.filter(isNotificationRecord));
}

export function getActivityLogs() {
  return readRecordList(KEYS.ACTIVITY_LOGS, INITIAL_ACTIVITY_LOGS);
}

export function appendActivityLog(actorName, action, target = '') {
  const logs = getActivityLogs();
  const entry = {
    id: `log-${Date.now()}`,
    actorName,
    action,
    target,
    timestampJalali: getCurrentJalaliTimestamp(),
  };
  logs.unshift(entry);
  saveActivityLogs(logs.slice(0, 100));
  return entry;
}

export function saveActivityLogs(logs) {
  return writeRecordList(KEYS.ACTIVITY_LOGS, logs);
}

export function getSettings() {
  const defaults = {
    siteNotice: 'نسخه آزمایشی SPORTLINK مشهد — اطلاعات مجموعه‌ها نمونه است.',
    allowClubRegistration: true,
    sessionTimeoutMinutes: 30,
    notificationSoundEnabled: false,
  };
  const saved = readJSON(KEYS.SETTINGS, defaults);
  if (!isRecord(saved)) return defaults;
  const timeout = Number(saved.sessionTimeoutMinutes);
  return {
    siteNotice: typeof saved.siteNotice === 'string' ? saved.siteNotice.slice(0, 500) : defaults.siteNotice,
    allowClubRegistration: typeof saved.allowClubRegistration === 'boolean' ? saved.allowClubRegistration : defaults.allowClubRegistration,
    sessionTimeoutMinutes: Number.isFinite(timeout) ? Math.min(1440, Math.max(5, timeout)) : defaults.sessionTimeoutMinutes,
    notificationSoundEnabled: typeof saved.notificationSoundEnabled === 'boolean' ? saved.notificationSoundEnabled : defaults.notificationSoundEnabled,
  };
}

export function saveSettings(settings) {
  if (!isRecord(settings)) return false;
  return writeJSON(KEYS.SETTINGS, {
    siteNotice: typeof settings.siteNotice === 'string' ? settings.siteNotice.slice(0, 500) : getSettings().siteNotice,
    allowClubRegistration: typeof settings.allowClubRegistration === 'boolean' ? settings.allowClubRegistration : getSettings().allowClubRegistration,
    sessionTimeoutMinutes: Number.isFinite(Number(settings.sessionTimeoutMinutes))
      ? Math.min(1440, Math.max(5, Number(settings.sessionTimeoutMinutes)))
      : getSettings().sessionTimeoutMinutes,
    notificationSoundEnabled: typeof settings.notificationSoundEnabled === 'boolean'
      ? settings.notificationSoundEnabled
      : getSettings().notificationSoundEnabled,
  });
}

export function getCurrentJalaliTimestamp() {
  try {
    const now = new Date();
    const datePart = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Tehran',
    }).format(now);
    const timePart = new Intl.DateTimeFormat('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Tehran',
    }).format(now);
    return `${datePart} - ${timePart}`;
  } catch {
    return '۱۴۰۵/۰۹/۰۱';
  }
}

export function getCurrentJalaliDate() {
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Tehran',
    }).format(new Date());
  } catch {
    return '۱۴۰۵/۰۹/۰۱';
  }
}
