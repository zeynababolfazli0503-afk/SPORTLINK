/**
 * SPORTLINK — Registration Page Controller
 * - Fields: firstName, lastName, email, mobile, password
 * - Live password strength meter (min 8 chars, no forced symbol/case rule, blocks common passwords)
 * - Terms & privacy checkbox with visible link
 * - Simulated mobile OTP verification step (email verification not required in MVP)
 */

import {
  validateRequiredText,
  validateEmail,
  validateIranianMobile,
  evaluatePasswordStrength,
  validateOtpCode,
} from '../validation.js';
import { getCurrentUser } from '../auth.js';
import { showToast, setButtonLoading } from '../components/ui.js';

export function initRegisterPage() {
  if (getCurrentUser()) {
    window.location.href = '/pages/profile.html';
    return;
  }

  const step1Form = document.getElementById('register-form');
  const step2Form = document.getElementById('otp-verify-form');
  const formAlert = document.getElementById('register-form-alert');

  const firstNameEl = document.getElementById('reg-first-name');
  const lastNameEl = document.getElementById('reg-last-name');
  const emailEl = document.getElementById('reg-email');
  const mobileEl = document.getElementById('reg-mobile');
  const passwordEl = document.getElementById('reg-password');
  const termsEl = document.getElementById('reg-terms');
  const togglePwdBtn = document.getElementById('reg-toggle-pwd');
  const submitBtn = document.getElementById('reg-submit-btn');

  const strengthText = document.getElementById('pwd-strength-label');
  const strengthSegs = document.querySelectorAll('#pwd-strength-bars .strength-seg');

  let pendingUserData = null;
  const DEMO_OTP = '482910';

  togglePwdBtn?.addEventListener('click', () => {
    if (!passwordEl) return;
    const isHidden = passwordEl.type === 'password';
    passwordEl.type = isHidden ? 'text' : 'password';
    togglePwdBtn.textContent = isHidden ? 'مخفی' : 'نمایش';
  });

  passwordEl?.addEventListener('input', () => {
    const evalRes = evaluatePasswordStrength(passwordEl.value);
    if (strengthText) {
      strengthText.textContent = evalRes.score === 0 ? 'قدرت رمز عبور' : `قدرت رمز: ${evalRes.label}`;
    }
    strengthSegs.forEach((seg, idx) => {
      seg.className = 'strength-seg';
      if (idx < evalRes.score) {
        seg.classList.add(`is-${evalRes.level}`);
      }
    });
  });

  function clearFieldError(inputEl, errorId) {
    inputEl?.classList.remove('is-invalid');
    const err = document.getElementById(errorId);
    if (err) err.textContent = '';
  }

  function setFieldError(inputEl, errorId, msg) {
    inputEl?.classList.add('is-invalid');
    const err = document.getElementById(errorId);
    if (err) err.textContent = msg;
  }

  let submitting = false;

  step1Form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (submitting) return;
    if (formAlert) formAlert.hidden = true;

    clearFieldError(firstNameEl, 'reg-first-name-error');
    clearFieldError(lastNameEl, 'reg-last-name-error');
    clearFieldError(emailEl, 'reg-email-error');
    clearFieldError(mobileEl, 'reg-mobile-error');
    clearFieldError(passwordEl, 'reg-password-error');
    const termsErr = document.getElementById('reg-terms-error');
    if (termsErr) termsErr.textContent = '';

    const fn = validateRequiredText(firstNameEl?.value, 'نام', 2, 50);
    const ln = validateRequiredText(lastNameEl?.value, 'نام خانوادگی', 2, 50);
    const em = validateEmail(emailEl?.value, true);
    const mob = validateIranianMobile(mobileEl?.value);
    const pw = evaluatePasswordStrength(passwordEl?.value);

    let hasError = false;
    if (!fn.valid) { setFieldError(firstNameEl, 'reg-first-name-error', fn.message); hasError = true; }
    if (!ln.valid) { setFieldError(lastNameEl, 'reg-last-name-error', ln.message); hasError = true; }
    if (!em.valid) { setFieldError(emailEl, 'reg-email-error', em.message); hasError = true; }
    if (!mob.valid) { setFieldError(mobileEl, 'reg-mobile-error', mob.message); hasError = true; }
    if (!pw.valid) { setFieldError(passwordEl, 'reg-password-error', pw.message); hasError = true; }
    if (!termsEl?.checked) {
      if (termsErr) termsErr.textContent = 'پذیرش قوانین و سیاست حفظ حریم خصوصی الزامی است.';
      hasError = true;
    }

    if (hasError) return;

    submitting = true;
    setButtonLoading(submitBtn, true, 'در حال بررسی نمایشی...');

    window.setTimeout(() => {
      submitting = false;
      setButtonLoading(submitBtn, false);
      pendingUserData = {
        firstName: fn.value,
        lastName: ln.value,
        email: em.normalized,
        mobile: mob.normalized,
      };
      if (passwordEl) passwordEl.value = '';

      step1Form.hidden = true;
      if (step2Form) {
        step2Form.hidden = false;
        const targetText = document.getElementById('otp-target-mobile');
        if (targetText) targetText.textContent = mob.normalized;
        document.getElementById('otp-code-input')?.focus();
      }
      showToast({ type: 'info', message: `کد آزمایشی (${DEMO_OTP}) فقط برای نمایش است؛ هیچ کدی ارسال نشد.` });
    }, 350);
  });

  // Step 2: OTP Confirmation
  const otpInput = document.getElementById('otp-code-input');
  const otpError = document.getElementById('otp-code-error');
  const otpSubmitBtn = document.getElementById('otp-submit-btn');

  document.getElementById('otp-back-btn')?.addEventListener('click', () => {
    if (step2Form) step2Form.hidden = true;
    if (step1Form) step1Form.hidden = false;
  });

  step2Form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!pendingUserData || submitting) return;
    if (otpError) otpError.textContent = '';
    otpInput?.classList.remove('is-invalid');

    const check = validateOtpCode(otpInput?.value || '');
    if (!check.valid) {
      if (otpError) otpError.textContent = check.message;
      otpInput?.classList.add('is-invalid');
      return;
    }

    if (check.normalized !== DEMO_OTP) {
      if (otpError) otpError.textContent = 'کد تأیید واردشده نادرست است.';
      otpInput?.classList.add('is-invalid');
      return;
    }

    submitting = true;
    setButtonLoading(otpSubmitBtn, true, 'در حال بررسی...');

    window.setTimeout(() => {
      submitting = false;
      setButtonLoading(otpSubmitBtn, false);
      pendingUserData = null;
      if (otpInput) otpInput.value = '';
      step2Form.hidden = true;
      step1Form.hidden = false;
      step1Form.reset();
      strengthSegs.forEach((seg) => { seg.className = 'strength-seg'; });
      if (strengthText) strengthText.textContent = 'قدرت رمز عبور';
      if (formAlert) {
        formAlert.className = 'form-alert is-info';
        formAlert.textContent = 'این فقط بررسی نمایشی بود؛ حسابی ایجاد نشد و اطلاعاتی ذخیره یا ارسال نشد. ثبت‌نام واقعی به سرویس بک‌اند نیاز دارد.';
        formAlert.hidden = false;
      }
      showToast({ type: 'info', message: 'ثبت‌نام واقعی هنوز به سرویس بک‌اند متصل نیست؛ اطلاعات ذخیره یا ارسال نشد.' });
    }, 350);
  });
}
