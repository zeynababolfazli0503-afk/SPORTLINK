/**
 * SPORTLINK — Contact Us Page Controller
 * Uses explicit placeholder contact channels instead of fabricated business claims.
 */

import { validateRequiredText, validateEmail } from '../validation.js';
import { showToast, setButtonLoading } from '../components/ui.js';

export function initContactPage() {
  const form = document.getElementById('contact-form');
  const nameEl = document.getElementById('contact-name');
  const emailEl = document.getElementById('contact-email');
  const subjectEl = document.getElementById('contact-subject');
  const msgEl = document.getElementById('contact-message');
  const submitBtn = document.getElementById('contact-submit-btn');
  const successAlert = document.getElementById('contact-success-alert');

  let submitting = false;

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (submitting) return;
    if (successAlert) successAlert.hidden = true;

    const vName = validateRequiredText(nameEl?.value, 'نام و نام خانوادگی', 2, 80);
    const vEmail = validateEmail(emailEl?.value, true);
    const vSubject = validateRequiredText(subjectEl?.value, 'موضوع پیام', 3, 120);
    const vMsg = validateRequiredText(msgEl?.value, 'متن پیام', 10, 1000);

    document.getElementById('contact-name-error').textContent = vName.valid ? '' : vName.message;
    document.getElementById('contact-email-error').textContent = vEmail.valid ? '' : vEmail.message;
    document.getElementById('contact-subject-error').textContent = vSubject.valid ? '' : vSubject.message;
    document.getElementById('contact-message-error').textContent = vMsg.valid ? '' : vMsg.message;

    if (!vName.valid || !vEmail.valid || !vSubject.valid || !vMsg.valid) return;

    submitting = true;
    setButtonLoading(submitBtn, true, 'در حال ارسال...');

    window.setTimeout(() => {
      submitting = false;
      setButtonLoading(submitBtn, false);
      form.reset();
      if (successAlert) {
        successAlert.className = 'form-alert is-info';
        successAlert.textContent = 'فرم از نظر ظاهری بررسی شد؛ پیام ارسال یا ذخیره نشد چون سرویس پشتیبانی متصل نیست.';
        successAlert.hidden = false;
      }
      showToast({ type: 'info', message: 'پیام ارسال نشد؛ اتصال بک‌اند پشتیبانی لازم است.' });
    }, 350);
  });
}
