/**
 * SPORTLINK — Report Club Issue Page Controller
 * Requires logged-in user. Categories, description, evidence attachment,
 * status tracking ("ثبت‌شده", "در حال بررسی", "نیازمند اطلاعات بیشتر", "رسیدگی‌شده", "ردشده"),
 * and admin reply display.
 */

import { getCurrentUser } from '../auth.js';
import { getPublishedClubs, getReports } from '../storage.js';
import { validateRequiredText } from '../validation.js';
import { getQueryParam, requireAuthOrRedirect } from '../router.js';
import { escapeHtml, showToast, setButtonLoading } from '../components/ui.js';

const REPORT_CATEGORIES = [
  'اطلاعات نادرست',
  'شماره تماس نامعتبر',
  'تعطیلی یا فعالیت نداشتن باشگاه',
  'تخلف',
  'سایر موارد',
];

export function initReportPage() {
  const user = getCurrentUser();
  if (!user) {
    requireAuthOrRedirect();
    return;
  }

  const clubs = getPublishedClubs();
  const initialClubId = getQueryParam('clubId', '');

  const clubSelect = document.getElementById('rep-club-select');
  const categorySelect = document.getElementById('rep-category');
  const descEl = document.getElementById('rep-description');
  const formEl = document.getElementById('report-form');
  const submitBtn = document.getElementById('rep-submit-btn');
  const listEl = document.getElementById('my-reports-list');
  const evidenceInput = document.getElementById('rep-evidence');
  const evidenceHint = document.getElementById('rep-evidence-hint');

  // The attachment input has no backend in the MVP; at least give real feedback
  // instead of silently accepting a file that is never used.
  evidenceInput?.addEventListener('change', () => {
    if (!evidenceHint) return;
    const name = evidenceInput.files?.[0]?.name || '';
    evidenceHint.textContent = name
      ? `فایل انتخاب‌شده: ${name} — در نسخه نمایشی بارگذاری نمی‌شود.`
      : 'هیچ فایلی انتخاب نشده است؛ در نسخه نمایشی فایل بارگذاری نمی‌شود.';
  });

  if (clubSelect) {
    clubSelect.innerHTML = `
      <option value="">انتخاب باشگاه...</option>
      ${clubs.map((c) => `<option value="${escapeHtml(c.id)}" ${c.id === initialClubId ? 'selected' : ''}>${escapeHtml(c.name)} (${escapeHtml(c.neighborhood)})</option>`).join('')}
    `;
  }

  if (categorySelect) {
    categorySelect.innerHTML = REPORT_CATEGORIES.map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');
  }

  const renderMyReports = () => {
    if (!listEl) return;
    const all = getReports();
    const mine = all.filter((r) => r.userId === user.id || user.role === 'super_admin');

    if (mine.length === 0) {
      listEl.innerHTML = `
        <div class="state-box">
          <h3>هنوز گزارشی ثبت نکرده‌اید</h3>
          <p>در صورت مشاهده مغایرت در اطلاعات مجموعه‌های مشهد، می‌توانید از فرم کنار گزارش ارسال کنید.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = mine
      .map(
        (r) => `
        <article class="card" style="padding:1rem;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.5rem;">
            <strong>${escapeHtml(r.clubName)}</strong>
            <span class="status-label ${r.status === 'رسیدگی‌شده' ? 'is-approved' : r.status === 'ردشده' ? 'is-rejected' : 'is-pending'}">${escapeHtml(r.status)}</span>
          </div>
          <div class="meta-inline" style="margin-bottom:0.45rem;">
            <span>${escapeHtml(r.category)}</span>
            <span class="meta-sep">·</span>
            <span class="tabular-nums">${escapeHtml(r.submittedAtJalali)}</span>
          </div>
          <p style="margin:0 0 0.5rem;font-size:0.875rem;">${escapeHtml(r.description)}</p>
          ${r.evidenceName ? `<div style="font-size:0.8125rem;color:var(--text-muted);">مدرک پیوست: ${escapeHtml(r.evidenceName)}</div>` : ''}
          ${
            r.adminReply
              ? `<div class="form-alert is-info" style="margin-top:0.65rem;padding:0.6rem 0.8rem;">
                   <strong>پاسخ پشتیبانی:</strong> ${escapeHtml(r.adminReply)}
                 </div>`
              : ''
          }
        </article>
      `
      )
      .join('');
  };

  formEl?.addEventListener('submit', (e) => {
    e.preventDefault();
    const clubId = clubSelect?.value || '';
    const vDesc = validateRequiredText(descEl?.value, 'توضیحات گزارش', 10, 800);

    document.getElementById('rep-club-error').textContent = clubId ? '' : 'لطفاً باشگاه موردنظر را انتخاب کنید.';
    document.getElementById('rep-desc-error').textContent = vDesc.valid ? '' : vDesc.message;

    if (!clubId || !vDesc.valid) return;

    setButtonLoading(submitBtn, true, 'در حال بررسی...');
    window.setTimeout(() => {
      setButtonLoading(submitBtn, false);
      formEl.reset();
      const statusEl = document.getElementById('report-demo-status');
      if (statusEl) {
        statusEl.textContent = 'گزارش از نظر ظاهری بررسی شد؛ ارسال یا ذخیره نشد چون سرویس گزارش متصل نیست.';
        statusEl.hidden = false;
      }
      showToast({ type: 'info', message: 'گزارش ارسال نشد؛ اتصال بک‌اند لازم است.' });
    }, 350);
  });

  renderMyReports();
}
