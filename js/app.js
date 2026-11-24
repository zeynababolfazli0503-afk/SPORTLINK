/**
 * SPORTLINK — Main Application Entry Point
 * Initializes global UI primitives, session inactivity tracking, header/footer,
 * and dispatches the current page module based on body[data-page].
 */

import { startLoadingBar, finishLoadingBar, initNetworkBanner } from './components/ui.js';
import { renderHeader } from './components/header.js';
import { renderFooter } from './components/footer.js';
import { refreshSessionActivity, hasSessionExpired } from './auth.js';

import { initHomePage } from './pages/home.js';
import { initClubsPage } from './pages/clubs.js';
import { initClubDetailPage } from './pages/club-detail.js';
import { initSportsPage } from './pages/sports.js';
import { initSportDetailPage } from './pages/sport-detail.js';
import { initLoginPage } from './pages/login.js';
import { initRegisterPage } from './pages/register.js';
import { initProfilePage } from './pages/profile.js';
import { initFavoritesPage } from './pages/favorites.js';
import { initComparePage } from './pages/compare.js';
import { initNotificationsPage } from './pages/notifications.js';
import { initManagementRequestPage } from './pages/management-request.js';
import { initManagerDashboardPage } from './pages/manager-dashboard.js';
import { initAdminDashboardPage } from './pages/admin-dashboard.js';
import { initContactPage } from './pages/contact.js';
import { initReportPage } from './pages/report.js';

const PAGE_CONTROLLERS = {
  home: { navKey: 'home', init: initHomePage },
  clubs: { navKey: 'clubs', init: initClubsPage },
  'club-detail': { navKey: 'clubs', init: initClubDetailPage },
  sports: { navKey: 'sports', init: initSportsPage },
  'sport-detail': { navKey: 'sports', init: initSportDetailPage },
  login: { navKey: '', init: initLoginPage },
  register: { navKey: '', init: initRegisterPage },
  profile: { navKey: '', init: initProfilePage },
  favorites: { navKey: '', init: initFavoritesPage },
  compare: { navKey: '', init: initComparePage },
  notifications: { navKey: '', init: initNotificationsPage },
  'management-request': { navKey: '', init: initManagementRequestPage },
  'manager-dashboard': { navKey: '', init: initManagerDashboardPage },
  'admin-dashboard': { navKey: '', init: initAdminDashboardPage },
  contact: { navKey: 'contact', init: initContactPage },
  report: { navKey: '', init: initReportPage },
  terms: { navKey: '', init: null },
  '404': { navKey: '', init: null },
  '403': { navKey: '', init: null },
  error: {
    navKey: '',
    init: () => {
      document.getElementById('error-reload-btn')?.addEventListener('click', () => window.location.reload());
    },
  },
};

function setupSessionActivityWatcher() {
  const events = ['click', 'keydown', 'scroll'];
  let lastRefresh = 0;
  const onActivity = () => {
    const now = Date.now();
    if (now - lastRefresh < 30000) return;
    lastRefresh = now;
    if (hasSessionExpired()) {
      const current = window.location.pathname + window.location.search;
      window.location.href = `/pages/login.html?expired=1&redirect=${encodeURIComponent(current)}`;
      return;
    }
    refreshSessionActivity();
  };

  events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
}

document.addEventListener('DOMContentLoaded', () => {
  startLoadingBar();
  initNetworkBanner();
  setupSessionActivityWatcher();

  const pageKey = document.body.dataset.page || 'home';
  const entry = PAGE_CONTROLLERS[pageKey];

  renderHeader(entry?.navKey || '');
  renderFooter();

  try {
    if (entry && typeof entry.init === 'function') {
      entry.init();
    }
  } catch (err) {
    console.error('Page initialization error:', err);
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.innerHTML = `
        <div class="container error-page-box">
          <div class="error-code">خطا</div>
          <h1>خطا در بارگذاری صفحه</h1>
          <p>در پردازش اطلاعات این صفحه مشکلی رخ داد. لطفاً دوباره تلاش کنید.</p>
          <a href="/index.html" class="btn btn-primary">بازگشت به صفحه اصلی</a>
        </div>
      `;
    }
  } finally {
    window.setTimeout(finishLoadingBar, 120);
  }
});
