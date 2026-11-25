/**
 * SPORTLINK — Glass Non-Sticky Header, Mobile Drawer & Logout Confirmation
 */

import { getCurrentUser, logoutUser, isAdminRole, isManagerRole } from '../auth.js';
import { getUnreadCount, onNotificationsChange } from '../notifications.js';
import { escapeHtml, confirmDialog, showToast } from './ui.js';

const NAV_LINKS = [
  { href: '/index.html', label: 'صفحه اصلی', key: 'home' },
  { href: '/pages/clubs.html', label: 'باشگاه‌ها', key: 'clubs' },
  { href: '/pages/sports.html', label: 'رشته‌های ورزشی', key: 'sports' },
  { href: '/index.html#about', label: 'درباره SPORTLINK', key: 'about' },
  { href: '/pages/contact.html', label: 'تماس با ما', key: 'contact' },
];

export function renderHeader(activeKey = '') {
  const container = document.getElementById('site-header');
  if (!container) return;

  const user = getCurrentUser();
  const unreadCount = getUnreadCount();

  const navHtml = NAV_LINKS.map(
    (link) => `
      <a href="${link.href}" class="nav-link ${activeKey === link.key ? 'is-active' : ''}">${escapeHtml(link.label)}</a>
    `
  ).join('');

  const bellHtml = `
    <a href="/pages/notifications.html" class="bell-link" aria-label="اعلان‌ها">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
      <span class="bell-count" id="header-bell-count" ${unreadCount === 0 ? 'hidden' : ''}>${unreadCount.toLocaleString('fa-IR')}</span>
    </a>
  `;

  let accountHtml = '';
  if (!user) {
    accountHtml = `
      <a href="/pages/login.html" class="btn btn-primary btn-sm desktop-only">ورود / ثبت‌نام</a>
    `;
  } else {
    const initials = `${(user.firstName || 'ک')[0]}`;
    const avatarInner = user.avatar
      ? `<img src="${escapeHtml(user.avatar)}" alt="${escapeHtml(user.firstName)}" />`
      : escapeHtml(initials);

    const roleLabel =
      user.role === 'super_admin'
        ? 'مدیر ارشد پلتفرم'
        : user.role === 'sub_admin'
          ? 'مدیر فرعی پلتفرم'
          : user.role === 'manager'
            ? 'مدیر باشگاه'
            : 'کاربر عضو';

    accountHtml = `
      <div class="user-menu-wrap desktop-only">
        <button type="button" class="user-menu-trigger" id="user-menu-trigger" aria-expanded="false" aria-haspopup="true">
          <span class="user-avatar-chip">${avatarInner}</span>
          <span>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <div class="dropdown-menu" id="user-dropdown-menu" hidden>
          <div class="dropdown-header">
            <span class="dropdown-header-name">${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</span>
            <span class="dropdown-header-role">${escapeHtml(roleLabel)}</span>
          </div>
          <a href="/pages/profile.html" class="dropdown-item">پروفایل من</a>
          <a href="/pages/favorites.html" class="dropdown-item">علاقه‌مندی‌ها</a>
          <a href="/pages/compare.html" class="dropdown-item">مقایسه مجموعه‌ها</a>
          <a href="/pages/management-request.html" class="dropdown-item">درخواست مدیریت مجموعه</a>
          <a href="/pages/notifications.html" class="dropdown-item">
            <span>اعلان‌ها</span>
            <span class="tabular-nums">${unreadCount > 0 ? unreadCount.toLocaleString('fa-IR') : ''}</span>
          </a>
          ${isManagerRole(user) ? '<a href="/pages/manager-dashboard.html" class="dropdown-item">پنل مدیر باشگاه</a>' : ''}
          ${isAdminRole(user) ? '<a href="/pages/admin-dashboard.html" class="dropdown-item">پنل مدیریت اصلی</a>' : ''}
          <button type="button" class="dropdown-item is-danger" id="header-logout-btn">خروج</button>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <header class="site-header">
      <div class="container header-inner">
        <a href="/index.html" class="brand-wordmark brand-logo-link" aria-label="SPORTLINK صفحه اصلی">
          <span class="brand-wordmark" dir="ltr"><span>SPORT</span><span style="color:var(--accent-gold);">LINK</span></span>
          <span class="brand-logo-frame">
            <img src="/assets/sportlink-logo.png" alt="SPORTLINK" class="brand-logo" width="40" height="40" />
          </span>
        </a>

        <nav class="header-nav" aria-label="ناوبری اصلی">
          ${navHtml}
        </nav>

        <div class="header-actions">
          ${bellHtml}
          ${accountHtml}
          <button type="button" class="mobile-menu-toggle" id="mobile-drawer-open" aria-label="باز کردن منو" aria-expanded="false">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    </header>

    <div class="drawer-backdrop" id="drawer-backdrop" hidden></div>
    <aside class="mobile-drawer" id="mobile-drawer" aria-label="منوی موبایل" hidden>
      <div class="drawer-top">
        <a href="/index.html" class="brand-wordmark brand-logo-link" aria-label="SPORTLINK صفحه اصلی">
          <span class="brand-wordmark" dir="ltr"><span>SPORT</span><span style="color:var(--accent-gold);">LINK</span></span>
          <span class="brand-logo-frame">
            <img src="/assets/sportlink-logo.png" alt="SPORTLINK" class="brand-logo" width="40" height="40" />
          </span>
        </a>
        <button type="button" class="btn-icon" id="mobile-drawer-close" aria-label="بستن منو">✕</button>
      </div>
      <nav class="drawer-links" aria-label="لینک‌های موبایل">
        ${NAV_LINKS.map((l) => `<a href="${l.href}" class="drawer-link ${activeKey === l.key ? 'is-active' : ''}">${escapeHtml(l.label)}</a>`).join('')}
        <a href="/pages/favorites.html" class="drawer-link">علاقه‌مندی‌ها</a>
        <a href="/pages/compare.html" class="drawer-link">مقایسه مجموعه‌ها</a>
        <a href="/pages/notifications.html" class="drawer-link">
          <span>اعلان‌ها</span>
          <span class="tabular-nums">${unreadCount > 0 ? unreadCount.toLocaleString('fa-IR') : ''}</span>
        </a>
        ${
          user
            ? `
              <a href="/pages/profile.html" class="drawer-link">پروفایل من</a>
              <a href="/pages/management-request.html" class="drawer-link">درخواست مدیریت مجموعه</a>
              ${isManagerRole(user) ? '<a href="/pages/manager-dashboard.html" class="drawer-link">پنل مدیر باشگاه</a>' : ''}
              ${isAdminRole(user) ? '<a href="/pages/admin-dashboard.html" class="drawer-link">پنل مدیریت اصلی</a>' : ''}
              <button type="button" class="btn btn-danger" id="drawer-logout-btn" style="margin-top:8px;">خروج از حساب</button>
            `
            : `<a href="/pages/login.html" class="btn btn-primary" style="margin-top:8px;">ورود / ثبت‌نام</a>`
        }
      </nav>
    </aside>
  `;

  // Wire dropdown
  const trigger = document.getElementById('user-menu-trigger');
  const menu = document.getElementById('user-dropdown-menu');
  if (trigger && menu) {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = menu.hidden;
      menu.hidden = !willOpen;
      trigger.setAttribute('aria-expanded', String(willOpen));
    });
    document.addEventListener('click', (e) => {
      if (!menu.hidden && !menu.contains(e.target) && e.target !== trigger) {
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.hidden) {
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        trigger.focus();
      }
    });
  }

  // Wire mobile drawer
  const openBtn = document.getElementById('mobile-drawer-open');
  const closeBtn = document.getElementById('mobile-drawer-close');
  const drawer = document.getElementById('mobile-drawer');
  const backdrop = document.getElementById('drawer-backdrop');

  const closeDrawer = () => {
    if (!drawer || !backdrop) return;
    drawer.hidden = true;
    backdrop.hidden = true;
    openBtn?.setAttribute('aria-expanded', 'false');
  };

  openBtn?.addEventListener('click', () => {
    if (!drawer || !backdrop) return;
    drawer.hidden = false;
    backdrop.hidden = false;
    openBtn.setAttribute('aria-expanded', 'true');
    closeBtn?.focus();
  });

  closeBtn?.addEventListener('click', closeDrawer);
  backdrop?.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer && !drawer.hidden) {
      closeDrawer();
      openBtn?.focus();
    }
  });

  // Wire Logout Confirmation Modal (انصراف / خروج)
  const handleLogoutClick = async () => {
    const confirmed = await confirmDialog({
      title: 'خروج از حساب کاربری',
      message: 'آیا مطمئن هستید که می‌خواهید از حساب کاربری خود خارج شوید؟',
      confirmLabel: 'خروج',
      cancelLabel: 'انصراف',
      danger: true,
      closeOnEscape: true,
    });
    if (confirmed) {
      logoutUser();
      showToast({ type: 'info', message: 'با موفقیت از حساب کاربری خارج شدید.' });
      window.setTimeout(() => {
        window.location.href = '/index.html';
      }, 350);
    }
  };

  document.getElementById('header-logout-btn')?.addEventListener('click', handleLogoutClick);
  document.getElementById('drawer-logout-btn')?.addEventListener('click', handleLogoutClick);

  // Live bell count updates
  onNotificationsChange((count) => {
    const badge = document.getElementById('header-bell-count');
    if (!badge) return;
    badge.textContent = count.toLocaleString('fa-IR');
    badge.hidden = count === 0;
  });
}
