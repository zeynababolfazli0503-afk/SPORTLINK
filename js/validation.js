/**
 * SPORTLINK — Pure Validation Rules
 * Supports Iranian mobile numbers, emails, and password policy (min 8 chars,
 * NO mandatory symbol/case composition, blocks very common/guessable passwords).
 */

const COMMON_PASSWORDS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'password1',
  'qwerty123',
  '11111111',
  '00000000',
  '87654321',
  'abcdefgh',
  'sportlink',
  'mashhad123',
  'admin1234',
  'user1234',
]);

export function normalizeDigits(input) {
  if (typeof input !== 'string') return '';
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  return input
    .replace(/[۰-۹]/g, (d) => String(persianDigits.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)));
}

export function validateIranianMobile(raw) {
  const value = normalizeDigits(String(raw || '').trim()).replace(/[\s-]/g, '');
  if (!value) {
    return { valid: false, message: 'شماره موبایل الزامی است.', normalized: '' };
  }
  if (!/^09\d{9}$/.test(value)) {
    return { valid: false, message: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.', normalized: value };
  }
  return { valid: true, message: '', normalized: value };
}

export function validateEmail(raw, required = true) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) {
    return required
      ? { valid: false, message: 'ایمیل الزامی است.', normalized: '' }
      : { valid: true, message: '', normalized: '' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
    return { valid: false, message: 'فرمت ایمیل معتبر نیست.', normalized: value };
  }
  return { valid: true, message: '', normalized: value };
}

export function validateIdentifier(raw) {
  const value = normalizeDigits(String(raw || '').trim());
  if (!value) {
    return { valid: false, type: null, message: 'لطفاً شماره موبایل یا ایمیل را وارد کنید.', normalized: '' };
  }
  if (value.includes('@')) {
    const res = validateEmail(value, true);
    return { ...res, type: 'email' };
  }
  const res = validateIranianMobile(value);
  return { ...res, type: 'mobile' };
}

export function evaluatePasswordStrength(password) {
  const pwd = String(password || '');
  if (!pwd) {
    return { score: 0, label: 'وارد نشده', level: 'empty', valid: false, message: 'رمز عبور الزامی است.' };
  }
  if (pwd.length < 8) {
    return { score: 1, label: 'خیلی کوتاه', level: 'weak', valid: false, message: 'رمز عبور باید حداقل ۸ کاراکتر باشد.' };
  }
  const lower = pwd.toLowerCase();
  if (COMMON_PASSWORDS.has(lower) || /^(.)\1+$/.test(pwd)) {
    return {
      score: 1,
      label: 'بسیار رایج و قابل حدس',
      level: 'weak',
      valid: false,
      message: 'این رمز عبور بسیار رایج یا قابل حدس است. لطفاً عبارت امن‌تری انتخاب کنید.',
    };
  }

  // Note: Does NOT force symbols/uppercase—only rewards length and variety naturally
  let score = 2;
  if (pwd.length >= 10) score += 1;
  if (pwd.length >= 13 || (/[a-zA-Z\u0600-\u06FF]/.test(pwd) && /\d/.test(pwd))) score += 1;
  if (score > 4) score = 4;

  const labels = {
    2: { label: 'قابل قبول', level: 'fair' },
    3: { label: 'خوب', level: 'good' },
    4: { label: 'قوی', level: 'strong' },
  };

  return {
    score,
    label: labels[score].label,
    level: labels[score].level,
    valid: true,
    message: '',
  };
}

export function validateRequiredText(raw, fieldLabel, minLen = 2, maxLen = 120) {
  const value = String(raw || '').trim();
  if (!value) {
    return { valid: false, message: `${fieldLabel} الزامی است.`, value: '' };
  }
  if (value.length < minLen) {
    return { valid: false, message: `${fieldLabel} باید حداقل ${minLen} کاراکتر باشد.`, value };
  }
  if (value.length > maxLen) {
    return { valid: false, message: `${fieldLabel} نباید بیشتر از ${maxLen} کاراکتر باشد.`, value };
  }
  return { valid: true, message: '', value };
}

export function validateOtpCode(raw) {
  const value = normalizeDigits(String(raw || '').trim());
  if (!/^\d{6}$/.test(value)) {
    return { valid: false, message: 'کد تأیید باید ۶ رقم باشد.', normalized: value };
  }
  return { valid: true, message: '', normalized: value };
}

export function validateOptionalUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return { valid: true, message: '', value: '' };
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, message: 'آدرس وب‌سایت باید با http:// یا https:// شروع شود.', value };
    }
    return { valid: true, message: '', value };
  } catch {
    return { valid: false, message: 'آدرس وب‌سایت معتبر نیست.', value };
  }
}
