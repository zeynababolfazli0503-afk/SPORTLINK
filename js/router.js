/**
 * SPORTLINK — Router, Query Helpers & Unsaved Changes Guard
 */

export function getQueryParams() {
  return new URLSearchParams(window.location.search);
}

export function getQueryParam(key, fallback = '') {
  return getQueryParams().get(key) ?? fallback;
}

export function updateQueryParams(paramsObj) {
  const url = new URL(window.location.href);
  Object.entries(paramsObj).forEach(([k, v]) => {
    if (v === '' || v === null || v === undefined || (Array.isArray(v) && v.length === 0)) {
      url.searchParams.delete(k);
    } else if (Array.isArray(v)) {
      url.searchParams.set(k, v.join(','));
    } else {
      url.searchParams.set(k, String(v));
    }
  });
  window.history.replaceState({}, '', url.toString());
}

export function navigateTo(path) {
  window.location.href = path;
}

export function requireAuthOrRedirect() {
  const current = window.location.pathname + window.location.search;
  window.location.href = `/pages/login.html?redirect=${encodeURIComponent(current)}`;
}

export function redirectTo403() {
  window.location.href = '/pages/403.html';
}

export function redirectTo404() {
  window.location.href = '/pages/404.html';
}

/**
 * Tracks dirty form state and protects against accidental navigation away
 * via both browser beforeunload and internal link click confirmation modal.
 */
export function setupUnsavedChangesGuard({ isDirty, confirmLeave }) {
  const handleBeforeUnload = (e) => {
    if (isDirty()) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', handleBeforeUnload);

  const handleLinkClick = async (e) => {
    const anchor = e.target.closest('a[href]');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || anchor.target === '_blank') return;
    if (!isDirty()) return;

    e.preventDefault();
    const shouldLeave = await confirmLeave();
    if (shouldLeave) {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.location.href = href;
    }
  };
  document.addEventListener('click', handleLinkClick);

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    document.removeEventListener('click', handleLinkClick);
  };
}
