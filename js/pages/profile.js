/**
 * SPORTLINK — User Profile Page Controller
 * Private profile visible only to owner/authorized admins.
 * Supports edit info, optional avatar preview, export personal data JSON,
 * account deletion request, and Unsaved Changes confirmation guard.
 */

import {
  getCurrentUser,
  exportCurrentUserData,
} from '../auth.js';
import { validateRequiredText, validateEmail } from '../validation.js';
import { requireAuthOrRedirect, setupUnsavedChangesGuard } from '../router.js';
import { escapeHtml, confirmDialog, showToast } from '../components/ui.js';

export function initProfilePage() {
  const user = getCurrentUser();
  if (!user) {
    requireAuthOrRedirect();
    return;
  }

  const root = document.getElementById('profile-root');
  if (!root) return;

  let isDirty = false;

  const roleLabels = {
    user: 'کاربر عضو',
    manager: 'مدیر باشگاه',
    sub_admin: 'مدیر فرعی SPORTLINK',
    super_admin: 'مدیر ارشد (Super Admin)',
  };

  root.innerHTML = `
    <div class="grid-2" style="align-items:start;">
      <section class="card">
        <h2 style="font-size:1.2rem;">ویرایش اطلاعات شخصی</h2>
        <p style="font-size:0.875rem;color:var(--text-muted);">
          نسخهٔ نمایشی به بک‌اند متصل نیست؛ تغییر پروفایل و حذف حساب ذخیره یا ارسال نمی‌شود. اطلاعات واقعی وارد نکنید.
        </p>

        <div id="profile-alert" class="form-alert" hidden style="margin-bottom:1rem;"></div>

        <form id="profile-form" class="form-stack" novalidate>
          <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
            <div class="user-avatar-chip" id="profile-avatar-preview" style="width:64px;height:64px;font-size:1.4rem;">
              ${user.avatar ? `<img src="${escapeHtml(user.avatar)}" alt="${escapeHtml(user.firstName)}" />` : escapeHtml((user.firstName || 'ک')[0])}
            </div>
            <div>
              <label class="btn btn-secondary btn-sm" for="profile-avatar-input">انتخاب تصویر پروفایل (اختیاری)</label>
              <input type="file" id="profile-avatar-input" accept="image/*" class="sr-only" />
              ${user.avatar ? '<button type="button" class="btn btn-ghost btn-sm" id="profile-avatar-clear">حذف تصویر</button>' : ''}
            </div>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label" for="prof-first-name">نام</label>
              <input type="text" id="prof-first-name" class="form-control" value="${escapeHtml(user.firstName)}" />
              <span class="field-error" id="prof-first-error"></span>
            </div>
            <div class="form-group">
              <label class="form-label" for="prof-last-name">نام خانوادگی</label>
              <input type="text" id="prof-last-name" class="form-control" value="${escapeHtml(user.lastName)}" />
              <span class="field-error" id="prof-last-error"></span>
            </div>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label" for="prof-mobile">شماره موبایل</label>
              <input type="text" id="prof-mobile" class="form-control tabular-nums" value="${escapeHtml(user.mobile)}" disabled />
              <span class="field-hint">شماره موبایل تاییدشده (تغییر از طریق پشتیبانی)</span>
            </div>
            <div class="form-group">
              <label class="form-label" for="prof-email">ایمیل</label>
              <input type="email" id="prof-email" class="form-control" value="${escapeHtml(user.email || '')}" />
              <span class="field-error" id="prof-email-error"></span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="prof-bio">اطلاعات تکمیلی (اختیاری)</label>
            <textarea id="prof-bio" class="form-textarea" placeholder="علاقه‌مندی‌های ورزشی یا توضیحات کوتاه">${escapeHtml(user.bio || '')}</textarea>
          </div>

          <div>
            <button type="submit" class="btn btn-primary" id="prof-save-btn">بررسی نمایشی تغییرات</button>
          </div>
        </form>
      </section>

      <aside class="form-stack">
        <div class="card">
          <h2 style="font-size:1.125rem;">وضعیت حساب</h2>
          <div class="info-list">
            <div class="info-list-row">
              <span class="info-list-label">نقش حساب</span>
              <span>${escapeHtml(roleLabels[user.role] || 'کاربر')}</span>
            </div>
            <div class="info-list-row">
              <span class="info-list-label">شهر پیش‌فرض</span>
              <span>${escapeHtml(user.city || 'مشهد')}</span>
            </div>
            <div class="info-list-row">
              <span class="info-list-label">تاریخ عضویت</span>
              <span class="tabular-nums">${escapeHtml(user.createdAtJalali || '—')}</span>
            </div>
          </div>
        </div>

        <div class="card">
          <h2 style="font-size:1.125rem;">حریم خصوصی و داده‌های شخصی</h2>
          <p style="font-size:0.875rem;color:var(--text-muted);">
            می‌توانید داده‌های نمایشی همین مرورگر را دانلود کنید. درخواست حذف واقعی حساب به سرویس بک‌اند نیاز دارد.
          </p>
          <div class="form-stack" style="gap:0.75rem;">
            <button type="button" class="btn btn-secondary" id="export-data-btn">دریافت نسخه اطلاعات شخصی (JSON)</button>
            <button type="button" class="btn btn-danger" id="delete-account-btn">بررسی نمایشی درخواست حذف حساب</button>
          </div>
        </div>
      </aside>
    </div>
  `;

  const form = document.getElementById('profile-form');
  const firstEl = document.getElementById('prof-first-name');
  const lastEl = document.getElementById('prof-last-name');
  const emailEl = document.getElementById('prof-email');
  const alertEl = document.getElementById('profile-alert');
  const avatarInput = document.getElementById('profile-avatar-input');
  const avatarPreview = document.getElementById('profile-avatar-preview');

  form?.addEventListener('input', () => {
    isDirty = true;
  });

  avatarInput?.addEventListener('change', () => {
    const file = avatarInput.files?.[0];
    if (!file) return;
    if (file.size > 1500000) {
      showToast({ type: 'error', message: 'حجم تصویر نباید بیش از ۱.۵ مگابایت باشد.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      isDirty = true;
      if (avatarPreview) {
        avatarPreview.innerHTML = `<img src="${escapeHtml(String(reader.result || ''))}" alt="پیش‌نمایش پروفایل" />`;
      }
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('profile-avatar-clear')?.addEventListener('click', () => {
    isDirty = true;
    if (avatarPreview) avatarPreview.textContent = (user.firstName || 'ک')[0];
  });

  // Setup Unsaved Changes Guard
  setupUnsavedChangesGuard({
    isDirty: () => isDirty,
    confirmLeave: () =>
      confirmDialog({
        title: 'تغییرات ذخیره‌نشده',
        message: 'تغییرات شما ذخیره نشده‌اند. آیا می‌خواهید بدون ذخیره از صفحه خارج شوید؟',
        confirmLabel: 'خروج بدون ذخیره',
        cancelLabel: 'ماندن در صفحه',
        danger: true,
        closeOnEscape: false,
      }),
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fn = validateRequiredText(firstEl?.value, 'نام', 2, 50);
    const ln = validateRequiredText(lastEl?.value, 'نام خانوادگی', 2, 50);
    const em = validateEmail(emailEl?.value, true);

    document.getElementById('prof-first-error').textContent = fn.valid ? '' : fn.message;
    document.getElementById('prof-last-error').textContent = ln.valid ? '' : ln.message;
    document.getElementById('prof-email-error').textContent = em.valid ? '' : em.message;

    if (!fn.valid || !ln.valid || !em.valid) return;

    if (alertEl) {
      alertEl.className = 'form-alert is-info';
      alertEl.textContent = 'اطلاعات معتبر است، اما تغییرات ذخیره نشد؛ ویرایش پروفایل به سرویس بک‌اند نیاز دارد.';
      alertEl.hidden = false;
    }
    isDirty = false;
    showToast({ type: 'info', message: 'تغییری ذخیره نشد؛ سرویس پروفایل هنوز متصل نیست.' });
  });

  document.getElementById('export-data-btn')?.addEventListener('click', () => {
    const data = exportCurrentUserData();
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sportlink-personal-data-${user.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ type: 'success', message: 'فایل اطلاعات شخصی دانلود شد.' });
  });

  const delBtn = document.getElementById('delete-account-btn');
  delBtn?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'درخواست حذف حساب کاربری',
      message: 'در این نسخه سرویس حذف حساب وجود ندارد؛ با ادامه نیز هیچ درخواستی ارسال یا حسابی تغییر داده نمی‌شود.',
      confirmLabel: 'متوجه شدم',
      cancelLabel: 'انصراف',
      danger: true,
      closeOnEscape: false,
    });
    if (ok) {
      showToast({ type: 'info', message: 'حساب تغییری نکرد؛ حذف واقعی به سرویس بک‌اند نیاز دارد.' });
    }
  });
}
