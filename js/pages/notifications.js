/**
 * SPORTLINK — Notifications Page Controller
 * View, filter by MVP type, mark read, single delete, clear all (with confirmation),
 * sound toggle (OFF by default), and demo push notification trigger.
 */

import {
  NOTIFICATION_TYPES,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications,
  pushNotification,
} from '../notifications.js';
import { getCurrentUser } from '../auth.js';
import { getSettings, saveSettings } from '../storage.js';
import { requireAuthOrRedirect } from '../router.js';
import { escapeHtml, getSafeInternalHref, confirmDialog, showToast } from '../components/ui.js';

export function initNotificationsPage() {
  const user = getCurrentUser();
  if (!user) {
    // Notifications are private — do not render them for guests.
    requireAuthOrRedirect();
    return;
  }

  const filterSelect = document.getElementById('notif-type-filter');
  const soundToggle = document.getElementById('notif-sound-toggle');
  const listEl = document.getElementById('notifications-list');

  let activeType = 'all';

  if (filterSelect) {
    filterSelect.innerHTML = `
      <option value="all">همه اعلان‌ها</option>
      ${NOTIFICATION_TYPES.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}
    `;
    filterSelect.addEventListener('change', () => {
      activeType = filterSelect.value;
      renderList();
    });
  }

  if (soundToggle) {
    const settings = getSettings();
    soundToggle.checked = Boolean(settings.notificationSoundEnabled);
    soundToggle.addEventListener('change', () => {
      const next = { ...getSettings(), notificationSoundEnabled: soundToggle.checked };
      saveSettings(next);
      showToast({
        type: 'info',
        message: soundToggle.checked ? 'صدای اعلان فعال شد.' : 'صدای اعلان غیرفعال شد.',
      });
    });
  }

  document.getElementById('notif-mark-all-btn')?.addEventListener('click', () => {
    markAllNotificationsRead();
    showToast({ type: 'success', message: 'همه اعلان‌ها به‌عنوان خوانده‌شده علامت‌گذاری شدند.' });
    renderList();
  });

  document.getElementById('notif-clear-all-btn')?.addEventListener('click', async () => {
    const current = getNotifications();
    if (current.length === 0) return;
    const confirmed = await confirmDialog({
      title: 'پاک‌کردن همه اعلان‌ها',
      message: 'آیا مطمئن هستید که می‌خواهید تمامی اعلان‌ها را حذف کنید؟ این عمل قابل بازگشت نیست.',
      confirmLabel: 'حذف همه',
      cancelLabel: 'انصراف',
      danger: true,
      closeOnEscape: false,
    });
    if (confirmed) {
      clearAllNotifications();
      showToast({ type: 'info', message: 'تمامی اعلان‌ها پاک شدند.' });
      renderList();
    }
  });

  document.getElementById('notif-simulate-btn')?.addEventListener('click', () => {
    const created = pushNotification({
      type: 'اطلاعیه‌های رسمی SPORTLINK',
      title: 'اعلان آزمایشی جدید SPORTLINK',
      message: 'این یک اعلان آزمایشی برای بررسی به‌روزرسانی شمارنده زنگوله و نمایش Toast است.',
      link: '/pages/clubs.html',
      userId: user.id,
    });
    showToast({ type: 'info', message: created.title });
    renderList();
  });

  function renderList() {
    if (!listEl) return;
    const all = getNotifications();
    const filtered = activeType === 'all' ? all : all.filter((n) => n.type === activeType);

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="state-box">
          <h3>اعلانی برای نمایش وجود ندارد</h3>
          <p>اعلان‌های سیستمی، اطلاعیه‌های رسمی و تغییر وضعیت درخواست‌های شما در این بخش نمایش داده می‌شوند.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered
      .map(
        (n) => `
        <article class="notif-item ${n.read ? '' : 'is-unread'}">
          <div style="display:flex;flex-direction:column;gap:0.35rem;">
            <div class="meta-inline">
              <span>${escapeHtml(n.type)}</span>
              <span class="meta-sep" aria-hidden="true">·</span>
              <span class="tabular-nums">${escapeHtml(n.createdAtJalali)}</span>
              ${!n.read ? '<span class="meta-sep" aria-hidden="true">·</span><span class="status-label is-pending">خوانده‌نشده</span>' : ''}
            </div>
            <h2 style="font-size:1rem;margin:0;">${escapeHtml(n.title)}</h2>
            <p style="margin:0;font-size:0.9rem;color:var(--gray-light);">${escapeHtml(n.message)}</p>
            ${getSafeInternalHref(n.link) ? `<div><a href="${escapeHtml(getSafeInternalHref(n.link))}" style="font-size:0.8125rem;color:var(--accent-gold);">مشاهده بخش مرتبط</a></div>` : ''}
          </div>
          <div style="display:flex;gap:0.5rem;flex-shrink:0;">
            ${
              !n.read
                ? `<button type="button" class="btn btn-secondary btn-sm js-notif-read" data-id="${escapeHtml(n.id)}">خوانده شد</button>`
                : ''
            }
            <button type="button" class="btn btn-ghost btn-sm js-notif-del" data-id="${escapeHtml(n.id)}" aria-label="حذف اعلان">حذف</button>
          </div>
        </article>
      `
      )
      .join('');

    listEl.querySelectorAll('.js-notif-read').forEach((btn) => {
      btn.addEventListener('click', () => {
        markNotificationRead(btn.dataset.id);
        renderList();
      });
    });

    listEl.querySelectorAll('.js-notif-del').forEach((btn) => {
      btn.addEventListener('click', () => {
        deleteNotification(btn.dataset.id);
        showToast({ type: 'info', message: 'اعلان حذف شد.' });
        renderList();
      });
    });
  }

  renderList();
}
