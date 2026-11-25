/**
 * SPORTLINK — Shared UI Primitives (XSS Escaping, Loading Bar, Toast, Modal, Offline)
 */

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getSafeInternalHref(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const origin = globalThis.location?.origin || 'https://sportlink.invalid';
  try {
    const url = new URL(value, origin);
    const isAppPath = url.pathname === '/' || url.pathname === '/index.html' || url.pathname.startsWith('/pages/');
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol) || !isAppPath) return '';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '';
  }
}

export function escapeCsvCell(value) {
  const raw = String(value ?? '');
  const safe = /^[\u0000-\u0020]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

// Top Loading Bar
let loadingBarEl = null;

function ensureLoadingBar() {
  if (loadingBarEl) return loadingBarEl;
  loadingBarEl = document.createElement('div');
  loadingBarEl.className = 'top-loading-bar';
  loadingBarEl.setAttribute('aria-hidden', 'true');
  document.body.prepend(loadingBarEl);
  return loadingBarEl;
}

export function startLoadingBar() {
  const bar = ensureLoadingBar();
  bar.classList.remove('is-done');
  bar.classList.add('is-active');
}

export function finishLoadingBar() {
  const bar = ensureLoadingBar();
  bar.classList.remove('is-active');
  bar.classList.add('is-done');
  window.setTimeout(() => {
    bar.classList.remove('is-done');
  }, 300);
}

// Toast Notification Stack (max 3 visible to avoid crowding)
let toastRegionEl = null;
const MAX_TOASTS = 3;

function ensureToastRegion() {
  if (toastRegionEl) return toastRegionEl;
  toastRegionEl = document.createElement('div');
  toastRegionEl.className = 'toast-region';
  toastRegionEl.setAttribute('role', 'status');
  toastRegionEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastRegionEl);
  return toastRegionEl;
}

/**
 * Displays a Toast message.
 * Durations per MVP spec:
 * - info/normal: 2500ms
 * - success: 4000ms
 * - error: 5000ms
 * - warning / sticky: manual close or action when persistent=true
 */
export function showToast({ type = 'info', message, duration, persistent = false, actionLabel, onAction }) {
  const region = ensureToastRegion();
  while (region.children.length >= MAX_TOASTS) {
    region.firstElementChild?.remove();
  }

  const defaultDurations = {
    info: 2600,
    success: 4000,
    warning: 4200,
    error: 5000,
  };
  const finalDuration = persistent ? 0 : (duration ?? defaultDurations[type] ?? 3000);

  const toast = document.createElement('div');
  toast.className = `toast is-${type}`;

  const typePrefix = {
    success: 'موفق:',
    error: 'خطا:',
    warning: 'هشدار:',
    info: 'اطلاع:',
  }[type] || '';

  toast.innerHTML = `
    <div>
      <strong>${escapeHtml(typePrefix)}</strong>
      <span>${escapeHtml(message)}</span>
    </div>
    <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
      ${actionLabel ? `<button type="button" class="btn btn-sm btn-secondary toast-action-btn">${escapeHtml(actionLabel)}</button>` : ''}
      <button type="button" class="btn-icon toast-close-btn" aria-label="بستن اعلان">✕</button>
    </div>
  `;

  const close = () => {
    toast.remove();
  };

  toast.querySelector('.toast-close-btn')?.addEventListener('click', close);
  if (actionLabel && onAction) {
    toast.querySelector('.toast-action-btn')?.addEventListener('click', () => {
      onAction();
      close();
    });
  }

  region.appendChild(toast);

  if (finalDuration > 0) {
    window.setTimeout(close, finalDuration);
  }
  return { close };
}

// Accessible Modal
let activeModalBackdrop = null;
let activeModalClose = null;

export function openModal({
  title,
  bodyHtml,
  footerHtml = '',
  closeOnEscape = true,
  size = 'md',
  onMount,
  onClose,
}) {
  closeActiveModal();

  const previousFocus = document.activeElement;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal-dialog ${size === 'lg' ? 'modal-lg' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title-heading">
      <div class="modal-header">
        <h2 id="modal-title-heading">${escapeHtml(title)}</h2>
        <button type="button" class="btn-icon modal-close-x" aria-label="بستن پنجره">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-actions">${footerHtml}</div>` : ''}
    </div>
  `;

  const dialog = backdrop.querySelector('.modal-dialog');

  const close = () => {
    document.removeEventListener('keydown', onKeyDown);
    backdrop.remove();
    if (activeModalBackdrop === backdrop) activeModalBackdrop = null;
    if (activeModalClose === close) activeModalClose = null;
    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus();
    }
    if (onClose) onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && closeOnEscape) {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      const focusables = dialog.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  backdrop.querySelector('.modal-close-x')?.addEventListener('click', close);
  if (closeOnEscape) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
  }

  document.addEventListener('keydown', onKeyDown);
  document.body.appendChild(backdrop);
  activeModalBackdrop = backdrop;
  activeModalClose = close;

  const firstInput = dialog.querySelector('input, select, textarea, button');
  if (firstInput) firstInput.focus();

  if (onMount) onMount(dialog, close);
  return { dialog, close };
}

export function closeActiveModal() {
  activeModalClose?.();
}

export function confirmDialog({
  title,
  message,
  confirmLabel = 'تأیید',
  cancelLabel = 'انصراف',
  danger = false,
  closeOnEscape = false,
}) {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (val) => {
      if (resolved) return;
      resolved = true;
      resolve(val);
    };

    const { dialog, close } = openModal({
      title,
      bodyHtml: `<p style="margin:0;color:var(--gray-light);">${escapeHtml(message)}</p>`,
      footerHtml: `
        <button type="button" class="btn btn-ghost modal-cancel-btn">${escapeHtml(cancelLabel)}</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'} modal-confirm-btn">${escapeHtml(confirmLabel)}</button>
      `,
      closeOnEscape,
      onClose: () => finish(false),
    });

    dialog.querySelector('.modal-cancel-btn')?.addEventListener('click', () => {
      finish(false);
      close();
    });
    dialog.querySelector('.modal-confirm-btn')?.addEventListener('click', () => {
      finish(true);
      close();
    });
  });
}

// Offline / Reconnect Monitoring
export function initNetworkBanner() {
  const banner = document.createElement('div');
  banner.className = 'offline-banner';
  banner.setAttribute('role', 'alert');
  banner.hidden = navigator.onLine;
  banner.innerHTML = '<span>اتصال اینترنت قطع شده است. برخی قابلیت‌ها تا برقراری مجدد اتصال به‌صورت محلی ذخیره می‌شوند.</span>';
  document.body.prepend(banner);

  window.addEventListener('offline', () => {
    banner.hidden = false;
  });

  window.addEventListener('online', () => {
    banner.hidden = true;
    showToast({ type: 'success', message: 'اتصال اینترنت برقرار شد.' });
  });
}

export function setButtonLoading(btn, isLoading, loadingText = 'در حال پردازش...') {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.origText = btn.textContent || '';
    btn.textContent = loadingText;
    btn.disabled = true;
    btn.classList.add('is-loading');
  } else {
    btn.textContent = btn.dataset.origText || btn.textContent;
    btn.disabled = false;
    btn.classList.remove('is-loading');
  }
}
