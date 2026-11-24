/**
 * SPORTLINK — Club Management & Registration Request Page Controller
 */

import { getCurrentUser } from '../auth.js';
import {
  getManagementRequests,
  getPublishedClubs,
} from '../storage.js';
import { MASHHAD_NEIGHBORHOODS, CLUB_TYPES } from '../data.js';
import { validateRequiredText, validateIranianMobile } from '../validation.js';
import { requireAuthOrRedirect } from '../router.js';
import { escapeHtml, showToast } from '../components/ui.js';

export function initManagementRequestPage() {
  const user = getCurrentUser();
  if (!user) {
    // Request status and applicant details are private — never render them for guests.
    requireAuthOrRedirect();
    return;
  }

  const clubs = getPublishedClubs();

  const firstEl = document.getElementById('mr-first-name');
  const lastEl = document.getElementById('mr-last-name');
  const mobileEl = document.getElementById('mr-mobile');
  const clubSelectEl = document.getElementById('mr-club-select');
  const clubNameEl = document.getElementById('mr-club-name');
  const formEl = document.getElementById('management-request-form');
  const submitBtn = document.getElementById('mr-submit-btn');
  const listEl = document.getElementById('mr-requests-list');

  // New club registration form toggle
  const newClubForm = document.getElementById('new-club-register-form');
  const ncNeighborhood = document.getElementById('nc-neighborhood');
  const ncType = document.getElementById('nc-type');

  if (user) {
    if (firstEl) firstEl.value = user.firstName || '';
    if (lastEl) lastEl.value = user.lastName || '';
    if (mobileEl) mobileEl.value = user.mobile || '';
  }

  if (clubSelectEl) {
    clubSelectEl.innerHTML = `
      <option value="">انتخاب از باشگاه‌های موجود مشهد (یا نام را پایین بنویسید)</option>
      ${clubs.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)} — ${escapeHtml(c.neighborhood)}</option>`).join('')}
    `;
    clubSelectEl.addEventListener('change', () => {
      const selected = clubs.find((c) => c.id === clubSelectEl.value);
      if (selected && clubNameEl) {
        clubNameEl.value = selected.name;
      }
    });
  }

  if (ncNeighborhood) {
    ncNeighborhood.innerHTML = MASHHAD_NEIGHBORHOODS.map((h) => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join('');
  }
  if (ncType) {
    ncType.innerHTML = CLUB_TYPES.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  }

  const renderRequests = () => {
    if (!listEl) return;
    const all = getManagementRequests();
    // Only records owned by the signed-in user. No guest/sample fallback.
    const relevant = all.filter((r) => r.userId === user.id);

    if (relevant.length === 0) {
      listEl.innerHTML = `
        <div class="state-box">
          <h3>درخواستی ثبت نشده است</h3>
          <p>پس از ثبت درخواست مدیریت، وضعیت بررسی مدارک و نتیجه آن در این بخش قابل پیگیری است.</p>
        </div>
      `;
      return;
    }

    const statusClass = (st) => {
      if (st === 'تأیید شده') return 'is-approved';
      if (st === 'رد شده') return 'is-rejected';
      return 'is-pending';
    };

    listEl.innerHTML = relevant
      .map(
        (r) => `
        <article class="card" style="padding:1rem;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.5rem;">
            <strong>${escapeHtml(r.clubName)}</strong>
            <span class="status-label ${statusClass(r.status)}">${escapeHtml(r.status)}</span>
          </div>
          <div class="meta-inline" style="margin-bottom:0.5rem;">
            <span>متقاضی: ${escapeHtml(r.firstName)} ${escapeHtml(r.lastName)}</span>
            <span class="meta-sep" aria-hidden="true">·</span>
            <span class="tabular-nums">${escapeHtml(r.mobile)}</span>
            <span class="meta-sep" aria-hidden="true">·</span>
            <span class="tabular-nums">${escapeHtml(r.submittedAtJalali)}</span>
          </div>
          ${r.documentName ? `<div style="font-size:0.8125rem;color:var(--text-muted);">مدرک پیوست: ${escapeHtml(r.documentName)}</div>` : ''}
          ${
            r.reason
              ? `<div class="form-alert is-error" style="margin-top:0.65rem;padding:0.6rem 0.8rem;">
                   <strong>توضیح بررسی:</strong> ${escapeHtml(r.reason)}
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
    const fn = validateRequiredText(firstEl?.value, 'نام', 2, 50);
    const ln = validateRequiredText(lastEl?.value, 'نام خانوادگی', 2, 50);
    const mob = validateIranianMobile(mobileEl?.value);
    const cn = validateRequiredText(clubNameEl?.value, 'نام باشگاه', 2, 100);

    document.getElementById('mr-first-error').textContent = fn.valid ? '' : fn.message;
    document.getElementById('mr-last-error').textContent = ln.valid ? '' : ln.message;
    document.getElementById('mr-mobile-error').textContent = mob.valid ? '' : mob.message;
    document.getElementById('mr-club-error').textContent = cn.valid ? '' : cn.message;

    if (!fn.valid || !ln.valid || !mob.valid || !cn.valid) return;

    const statusEl = document.getElementById('management-demo-status');
    if (statusEl) {
      statusEl.textContent = 'اطلاعات فرم معتبر است، اما درخواست ارسال یا ذخیره نشد؛ اتصال بک‌اند لازم است.';
      statusEl.hidden = false;
    }
    formEl?.reset();
    if (user) {
      if (firstEl) firstEl.value = user.firstName || '';
      if (lastEl) lastEl.value = user.lastName || '';
      if (mobileEl) mobileEl.value = user.mobile || '';
    }
    showToast({ type: 'info', message: 'درخواست ارسال نشد؛ سرویس مدیریت باشگاه هنوز متصل نیست.' });
  });

  // New Club Registration Request (creates pending club—NOT shown in public directory until approved)
  newClubForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const ncName = document.getElementById('nc-name');
    const ncAddr = document.getElementById('nc-address');
    const ncPhone = document.getElementById('nc-phone');
    const ncDesc = document.getElementById('nc-desc');

    const vName = validateRequiredText(ncName?.value, 'نام مجموعه', 2, 100);
    const vAddr = validateRequiredText(ncAddr?.value, 'آدرس در مشهد', 5, 160);
    const vPhone = validateRequiredText(ncPhone?.value, 'شماره تماس', 6, 30);
    const vDesc = validateRequiredText(ncDesc?.value, 'توضیحات', 10, 500);

    document.getElementById('nc-name-error').textContent = vName.valid ? '' : vName.message;
    document.getElementById('nc-address-error').textContent = vAddr.valid ? '' : vAddr.message;
    document.getElementById('nc-phone-error').textContent = vPhone.valid ? '' : vPhone.message;
    document.getElementById('nc-desc-error').textContent = vDesc.valid ? '' : vDesc.message;

    if (!vName.valid || !vAddr.valid || !vPhone.valid || !vDesc.valid) return;

    const statusEl = document.getElementById('new-club-demo-status');
    if (statusEl) {
      statusEl.textContent = 'اطلاعات فرم معتبر است، اما درخواست ارسال یا ذخیره نشد؛ اتصال بک‌اند لازم است.';
      statusEl.hidden = false;
    }
    newClubForm.reset();
    showToast({ type: 'info', message: 'درخواست ارسال نشد؛ سرویس ثبت مجموعه هنوز متصل نیست.' });
  });

  renderRequests();
}
