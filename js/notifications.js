/**
 * SPORTLINK — Notifications Module
 * Handles unread badge counts, mark-as-read, single delete, clear all,
 * new notification creation, and optional muted-by-default sound setting.
 *
 * SECURITY NOTE (MVP): Notification records are split into per-user LocalStorage
 * stores. This prevents accidental cross-account mixing in this frontend-only
 * demo, but LocalStorage is client-side data and provides NO real security.
 * A production backend MUST authenticate the requester and authorize every
 * read/modify/delete against the notification owner on the server.
 */

import { getCurrentUser } from './auth.js';
import {
  getUsers,
  getNotificationsList,
  saveNotificationsList,
  getNotificationsListForUser,
  saveNotificationsListForUser,
  getCurrentJalaliTimestamp,
  getSettings,
} from './storage.js';

export const NOTIFICATION_TYPES = [
  'اعلان‌های سیستمی',
  'تغییر وضعیت درخواست مدیریت',
  'تغییر وضعیت گزارش',
  'تغییر وضعیت درخواست ثبت باشگاه',
  'اطلاعیه‌های رسمی SPORTLINK',
];

const listeners = new Set();

export function onNotificationsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emitChange() {
  const count = getUnreadCount();
  listeners.forEach((fn) => {
    try {
      fn(count);
    } catch {
      // ignore listener errors
    }
  });
}

function currentUserId() {
  const user = getCurrentUser();
  return user ? user.id : null;
}

/** Notifications visible to the signed-in user only. Guests see nothing. */
export function getNotifications() {
  const userId = currentUserId();
  if (!userId) return [];
  return getNotificationsListForUser(userId);
}

export function getUnreadCount() {
  if (!currentUserId()) return 0;
  return getNotifications().filter((n) => !n.read).length;
}

/** All mutations go through the current user's own store. */
function persistForCurrentUser(list) {
  const userId = currentUserId();
  if (!userId) return;
  saveNotificationsListForUser(userId, list);
  emitChange();
}

export function markNotificationRead(id) {
  const list = getNotifications().map((n) => (n.id === id ? { ...n, read: true } : n));
  persistForCurrentUser(list);
  return getNotifications();
}

export function markAllNotificationsRead() {
  const list = getNotifications().map((n) => ({ ...n, read: true }));
  persistForCurrentUser(list);
  return getNotifications();
}

export function deleteNotification(id) {
  const list = getNotifications().filter((n) => n.id !== id);
  persistForCurrentUser(list);
  return getNotifications();
}

export function clearAllNotifications() {
  persistForCurrentUser([]);
  return [];
}

/**
 * Creates a notification.
 * - With `userId`: a private record stored only in that user's store.
 * - Without `userId`: a public broadcast, appended to every known user's store
 *   and to the legacy global key so users created later still receive it.
 */
export function pushNotification({ type, title, message, link = '/pages/notifications.html', userId = null }) {
  const item = {
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type: type || 'اعلان‌های سیستمی',
    title,
    message,
    read: false,
    createdAtJalali: getCurrentJalaliTimestamp(),
    link,
    userId: userId || null,
  };

  if (userId) {
    saveNotificationsListForUser(userId, [item, ...getNotificationsListForUser(userId)]);
  } else {
    saveNotificationsList([item, ...getNotificationsList()]);
    getUsers().forEach((u) => {
      saveNotificationsListForUser(u.id, [item, ...getNotificationsListForUser(u.id)]);
    });
  }

  emitChange();

  // Sound is OFF by default in MVP settings
  const settings = getSettings();
  if (settings.notificationSoundEnabled) {
    playSubtleChime();
  }

  return item;
}

function playSubtleChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } catch {
    // ignore audio block
  }
}
