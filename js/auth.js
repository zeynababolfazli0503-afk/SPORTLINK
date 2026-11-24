/**
 * SPORTLINK — Simulated Frontend Authentication & Session Module
 * IMPORTANT: No real backend exists in this MVP stage.
 * - Never stores plaintext passwords in LocalStorage.
 * - Login failures return a uniform non-enumerating message.
 * - Session expires after inactivity timeout without deactivating the user account.
 */

import {
  getUsers,
  getSession,
  saveSession,
  getSettings,
  KEYS,
  readJSON,
} from './storage.js';
import { validateIdentifier } from './validation.js';

/**
 * Demo role switching is a development aid only.
 * Vite statically replaces import.meta.env, so this constant is false in
 * production bundles: the dev-only panel stays hidden and demo login is
 * rejected (the branch can then be tree-shaken). Outside Vite (Node tests)
 * import.meta.env is undefined => false.
 */
export const DEMO_AUTH_ENABLED = Boolean(import.meta.env?.DEV);

function getTimeoutMs() {
  const mins = Number(getSettings().sessionTimeoutMinutes || 30);
  return Math.max(5, mins) * 60 * 1000;
}

export function getActiveSession() {
  const session = getSession();
  if (!session) return null;
  if (Date.now() > Number(session.expiresAt || 0)) {
    // Session expired due to inactivity — clear session only, keep account active
    saveSession(null);
    return null;
  }
  return session;
}

export function refreshSessionActivity() {
  const session = getActiveSession();
  if (!session) return null;
  const now = Date.now();
  const updated = {
    ...session,
    lastActivityAt: now,
    expiresAt: now + getTimeoutMs(),
  };
  saveSession(updated);
  return updated;
}

export function getCurrentUser() {
  const session = getActiveSession();
  if (!session) return null;
  const users = getUsers();
  const found = users.find((u) => u.id === session.userId && u.active !== false);
  return found || null;
}

export function hasSessionExpired() {
  const raw = getSession();
  if (!raw) return false;
  return Date.now() > Number(raw.expiresAt || 0);
}

/**
 * Simulated login.
 * Never exposes whether mobile/email exists in system on error.
 */
export function loginWithCredentials(identifierRaw, passwordRaw) {
  const idCheck = validateIdentifier(identifierRaw);
  const pwd = String(passwordRaw || '');

  if (!idCheck.valid) {
    return { ok: false, field: 'identifier', message: idCheck.message };
  }
  if (!pwd) {
    return { ok: false, field: 'password', message: 'رمز عبور را وارد کنید.' };
  }

  const unavailableMessage = 'ورود با رمز عبور تا اتصال سرویس احراز هویت فعال نیست.';

  return {
    ok: false,
    field: 'unavailable',
    message: DEMO_AUTH_ENABLED
      ? `${unavailableMessage} برای بررسی نقش‌ها از ورودهای آزمایشی استفاده کنید.`
      : unavailableMessage,
  };
}

export function loginAsDemoAccount(userId) {
  if (!DEMO_AUTH_ENABLED) {
    return { ok: false, message: 'ورود آزمایشی فقط در محیط توسعه در دسترس است.' };
  }
  const users = getUsers();
  const match = users.find((u) => u.id === userId && u.active !== false);
  if (!match) return { ok: false, message: 'حساب آزمایشی یافت نشد.' };
  const now = Date.now();
  saveSession({
    userId: match.id,
    role: match.role,
    loginAt: now,
    lastActivityAt: now,
    expiresAt: now + getTimeoutMs(),
  });
  return { ok: true, user: match };
}

export function logoutUser() {
  saveSession(null);
}

export function exportCurrentUserData() {
  const current = getCurrentUser();
  if (!current) return null;
  const { demoVerifier: _ignored, ...safeProfile } = current;
  const favs = readJSON(`${KEYS.FAVORITES_USER_PREFIX}${current.id}`, { clubs: [], sports: [] });
  return {
    exportedAt: new Date().toISOString(),
    note: 'نسخه خروجی اطلاعات شخصی کاربر در SPORTLINK (نسخه آزمایشی)',
    profile: safeProfile,
    favorites: favs,
  };
}

export function isAdminRole(user) {
  return Boolean(user && (user.role === 'super_admin' || user.role === 'sub_admin'));
}

export function isManagerRole(user) {
  return Boolean(user && user.role === 'manager' && user.managedClubId);
}
