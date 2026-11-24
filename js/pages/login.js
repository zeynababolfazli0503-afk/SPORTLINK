/**
 * SPORTLINK — Login Page Controller
 * - Login via mobile or email + password
 * - Password visibility toggle
 * - Non-enumerating error message
 * - Loading state & double-submit protection
 * - Forgot password modal
 * - Redirect back to requested URL after login
 */

import { loginWithCredentials, loginAsDemoAccount, getCurrentUser, DEMO_AUTH_ENABLED } from '../auth.js';
import { validateIdentifier } from '../validation.js';
import { getQueryParam } from '../router.js';
import { openModal, showToast, setButtonLoading, getSafeInternalHref } from '../components/ui.js';

function getSafeRedirectUrl() {
  const raw = getQueryParam('redirect', '');
  return getSafeInternalHref(raw) || '/pages/profile.html';
}

export function initLoginPage() {
  if (getCurrentUser()) {
    window.location.href = getSafeRedirectUrl();
    return;
  }

  const form = document.getElementById('login-form');
  const identifierInput = document.getElementById('login-identifier');
  const passwordInput = document.getElementById('login-password');
  const togglePwdBtn = document.getElementById('login-toggle-pwd');
  const submitBtn = document.getElementById('login-submit-btn');
  const formAlert = document.getElementById('login-form-alert');
  const idError = document.getElementById('login-identifier-error');
  const pwdError = document.getElementById('login-password-error');
  const expiredBanner = document.getElementById('session-expired-alert');

  if (getQueryParam('expired', '') === '1' && expiredBanner) {
    expiredBanner.hidden = false;
  }

  togglePwdBtn?.addEventListener('click', () => {
    if (!passwordInput) return;
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    togglePwdBtn.setAttribute('aria-label', isHidden ? 'مخفی کردن رمز عبور' : 'نمایش رمز عبور');
    togglePwdBtn.textContent = isHidden ? 'مخفی' : 'نمایش';
  });

  let submitting = false;

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (submitting) return;

    if (idError) idError.textContent = '';
    if (pwdError) pwdError.textContent = '';
    if (formAlert) formAlert.hidden = true;
    identifierInput?.classList.remove('is-invalid');
    passwordInput?.classList.remove('is-invalid');

    const idVal = identifierInput?.value || '';
    const pwdVal = passwordInput?.value || '';

    const idCheck = validateIdentifier(idVal);
    if (!idCheck.valid) {
      if (idError) idError.textContent = idCheck.message;
      identifierInput?.classList.add('is-invalid');
      identifierInput?.focus();
      return;
    }

    if (!pwdVal) {
      if (pwdError) pwdError.textContent = 'رمز عبور را وارد کنید.';
      passwordInput?.classList.add('is-invalid');
      passwordInput?.focus();
      return;
    }

    submitting = true;
    setButtonLoading(submitBtn, true, 'در حال بررسی...');

    window.setTimeout(() => {
      const res = loginWithCredentials(idVal, pwdVal);
      submitting = false;
      setButtonLoading(submitBtn, false);

      if (!res.ok) {
        if (formAlert) {
          formAlert.className = `form-alert ${res.field === 'unavailable' ? 'is-info' : 'is-error'}`;
          formAlert.textContent = res.message;
          formAlert.hidden = false;
        }
        return;
      }

      showToast({ type: 'success', message: `${res.user.firstName} عزیز، خوش آمدید.` });
      window.setTimeout(() => {
        window.location.href = getSafeRedirectUrl();
      }, 300);
    }, 350);
  });

  // Forgot password modal (does not reveal whether email/mobile exists)
  document.getElementById('forgot-password-btn')?.addEventListener('click', () => {
    const { dialog, close } = openModal({
      title: 'بازیابی رمز عبور',
      bodyHtml: `
        <form id="forgot-form" class="form-stack" novalidate>
          <p style="margin:0;color:var(--text-muted);font-size:0.9rem;">
            شماره موبایل یا ایمیل خود را وارد کنید. در صورت وجود حساب فعال، راهنمای بازیابی (در نسخه واقعی) ارسال خواهد شد.
          </p>
          <div class="form-group">
            <label class="form-label" for="forgot-identifier">شماره موبایل یا ایمیل</label>
            <input type="text" id="forgot-identifier" class="form-control" placeholder="0915... یا name@example.com" />
            <span class="field-error" id="forgot-error"></span>
          </div>
          <div class="modal-actions" style="margin-top:0;">
            <button type="button" class="btn btn-ghost" id="forgot-cancel">انصراف</button>
            <button type="submit" class="btn btn-primary">ارسال درخواست بازیابی</button>
          </div>
        </form>
      `,
    });

    dialog.querySelector('#forgot-cancel')?.addEventListener('click', close);
    dialog.querySelector('#forgot-form')?.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const input = dialog.querySelector('#forgot-identifier');
      const errEl = dialog.querySelector('#forgot-error');
      const check = validateIdentifier(input?.value || '');
      if (!check.valid) {
        if (errEl) errEl.textContent = check.message;
        input?.classList.add('is-invalid');
        return;
      }
      close();
      showToast({
        type: 'info',
        message: 'بازیابی رمز به سرویس بک‌اند متصل نیست؛ درخواستی ارسال نشد.',
      });
    });
  });

  // Demo quick role switchers — development builds only.
  // The panel is created at runtime; DEMO_AUTH_ENABLED folds to false in
  // production, so no demo markup or handlers exist in the production output.
  if (DEMO_AUTH_ENABLED) {
    const authCard = document.querySelector('.auth-card');
    if (authCard) {
      const demoPanel = document.createElement('div');
      demoPanel.id = 'demo-login-panel';
      demoPanel.style.cssText = 'margin-top:2rem;padding-top:1.25rem;border-top:1px solid var(--border-subtle);';
      demoPanel.innerHTML = `
        <div style="font-size:0.8125rem;color:var(--text-muted);margin-bottom:0.75rem;">
          ورود سریع آزمایشی فقط در محیط توسعه (شبیهسازی فرانتاند بدون سرور):
        </div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary btn-sm js-demo-login-btn" data-user-id="user-member-1">کاربر عادی</button>
          <button type="button" class="btn btn-secondary btn-sm js-demo-login-btn" data-user-id="user-manager-1">مدیر باشگاه</button>
          <button type="button" class="btn btn-secondary btn-sm js-demo-login-btn" data-user-id="user-subadmin-1">مدیر فرعی</button>
          <button type="button" class="btn btn-secondary btn-sm js-demo-login-btn" data-user-id="user-superadmin-1">Super Admin</button>
        </div>
      `;
      authCard.appendChild(demoPanel);
      demoPanel.querySelectorAll('.js-demo-login-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const res = loginAsDemoAccount(btn.dataset.userId);
          if (res.ok) {
            // showToast escapes the message itself; no manual escaping needed here.
            showToast({ type: 'success', message: `ورود آزمایشی با نقش ${res.user.firstName} ${res.user.lastName}` });
            window.setTimeout(() => {
              window.location.href = getSafeRedirectUrl();
            }, 300);
          } else if (res.message) {
            showToast({ type: 'error', message: res.message });
          }
        });
      });
    }
  }
}
