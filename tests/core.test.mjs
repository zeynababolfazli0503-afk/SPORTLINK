import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { CATEGORIES, SPORTS, INITIAL_CLUBS, MASHHAD_NEIGHBORHOODS } from '../js/data.js';
import {
  validateIranianMobile,
  validateEmail,
  evaluatePasswordStrength,
  validateOtpCode,
} from '../js/validation.js';
import { filterClubs, sortClubs, paginateItems, DESKTOP_PAGE_SIZE, MOBILE_PAGE_SIZE } from '../js/filters.js';
import { getSearchSuggestions, isNewGenuineSearch, recordSearchImpressions } from '../js/search.js';
import { canAccessAdminSection, getAdminNavItems } from '../js/admin-rbac.js';
import { escapeCsvCell, getSafeInternalHref } from '../js/components/ui.js';
import { loginWithCredentials, loginAsDemoAccount } from '../js/auth.js';
import { getNotifications, getUnreadCount, markNotificationRead } from '../js/notifications.js';
import { getUsers, saveUsers, getNotificationsList, KEYS } from '../js/storage.js';
import { INITIAL_NOTIFICATIONS } from '../js/data.js';

test('MVP data integrity: 7 categories and exactly 35 sports', () => {
  assert.equal(CATEGORIES.length, 7);
  assert.equal(SPORTS.length, 35);
  const categoryIds = new Set(CATEGORIES.map((c) => c.id));
  for (const sport of SPORTS) {
    assert.ok(categoryIds.has(sport.categoryId), `Sport ${sport.id} has valid category`);
  }
});

test('MVP geographic scope: all clubs are in Mashhad and directory excludes pending clubs', () => {
  for (const club of INITIAL_CLUBS) {
    assert.equal(club.city, 'مشهد');
    assert.ok(MASHHAD_NEIGHBORHOODS.includes(club.neighborhood));
  }
  const published = filterClubs(INITIAL_CLUBS, {}, SPORTS);
  assert.ok(published.every((c) => c.status === 'published'));
  assert.ok(published.length < INITIAL_CLUBS.length, 'Pending club must be excluded from public filter');
});

test('Validation: Iranian mobile, email, OTP, and non-restrictive password policy', () => {
  assert.equal(validateIranianMobile('۰۹۱۵۱۲۳۴۵۶۷').valid, true);
  assert.equal(validateIranianMobile('09151234567').valid, true);
  assert.equal(validateIranianMobile('08151234567').valid, false);

  assert.equal(validateEmail('user@sportlink.ir').valid, true);
  assert.equal(validateEmail('invalid-email').valid, false);

  assert.equal(validateOtpCode('۱۲۳۴۵۶').valid, true);
  assert.equal(validateOtpCode('123').valid, false);

  // Min 8 chars without forcing symbols/uppercase
  assert.equal(evaluatePasswordStrength('mashhad9').valid, true);
  // Too short
  assert.equal(evaluatePasswordStrength('abc123').valid, false);
  // Common guessable password blocked
  assert.equal(evaluatePasswordStrength('12345678').valid, false);
  assert.equal(evaluatePasswordStrength('password').valid, false);
});

test('Filtering, sorting, and pagination work accurately', () => {
  const sajjadClubs = filterClubs(INITIAL_CLUBS, { neighborhood: 'سجاد' }, SPORTS);
  assert.ok(sajjadClubs.length >= 2);
  assert.ok(sajjadClubs.every((c) => c.neighborhood === 'سجاد'));

  const inquiryOnly = filterClubs(INITIAL_CLUBS, { priceRange: 'inquiry_only' }, SPORTS);
  assert.ok(inquiryOnly.every((c) => c.priceInfo.hasPrice === false));

  const sortedAlpha = sortClubs(sajjadClubs, 'alpha_asc');
  assert.equal(sortedAlpha.length, sajjadClubs.length);

  const deskPage = paginateItems(filterClubs(INITIAL_CLUBS, {}, SPORTS), 1, DESKTOP_PAGE_SIZE);
  assert.equal(deskPage.items.length, 12);

  const mobPage = paginateItems(filterClubs(INITIAL_CLUBS, {}, SPORTS), 1, MOBILE_PAGE_SIZE);
  assert.equal(mobPage.items.length, 6);
});

test('Search suggestions match Mashhad clubs, neighborhoods, and sports', () => {
  const clubMatches = getSearchSuggestions('سجاد', 'clubs', INITIAL_CLUBS, SPORTS);
  assert.ok(clubMatches.some((s) => s.kind === 'club' || s.kind === 'neighborhood'));

  const sportMatches = getSearchSuggestions('پیلاتس', 'sports', INITIAL_CLUBS, SPORTS);
  assert.ok(sportMatches.some((s) => s.kind === 'sport'));
});

test('Internal links reject script schemes, external origins, and slash-backslash redirects', () => {
  assert.equal(getSafeInternalHref('/pages/clubs.html?q=sport'), '/pages/clubs.html?q=sport');
  assert.equal(getSafeInternalHref('/index.html'), '/index.html');
  assert.equal(getSafeInternalHref('javascript:alert(1)'), '');
  assert.equal(getSafeInternalHref('//example.com/pages/login.html'), '');
  assert.equal(getSafeInternalHref('/\\example.com'), '');
  assert.equal(getSafeInternalHref('/assets/private.txt'), '');
});

test('CSV cells neutralize spreadsheet formulas and preserve CSV quoting', () => {
  assert.equal(escapeCsvCell('=HYPERLINK("https://example.com")'), `"'=HYPERLINK(""https://example.com"")"`);
  assert.equal(escapeCsvCell('  @SUM(1,2)'), '"\'  @SUM(1,2)"');
  assert.equal(escapeCsvCell('نام "نمونه"'), '"نام ""نمونه"""');
});

test('Credential login stays unavailable until a backend is connected', () => {
  const result = loginWithCredentials('user@sportlink.ir', 'any-entered-value');
  assert.equal(result.ok, false);
  assert.equal(result.field, 'unavailable');
  // The copy is user-facing (سرویس احراز هویت) instead of the internal term.
  assert.match(result.message, /سرویس احراز هویت/);
  assert.match(result.message, /فعال نیست/);
});

test('Local user storage strips credential fields and ignores malformed list shapes', () => {
  const previousWindow = globalThis.window;
  const values = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    },
  };

  try {
    const user = { id: 'test-user', role: 'user', firstName: 'آزمایشی', lastName: 'کاربر', password: 'must-not-persist', demoVerifier: 'old-verifier' };
    assert.equal(saveUsers([user]), true);
    const storedUsers = JSON.parse(values.get(KEYS.USERS));
    assert.equal('password' in storedUsers[0], false);
    assert.equal('demoVerifier' in storedUsers[0], false);
    assert.equal(getUsers()[0].id, 'test-user');

    values.set(KEYS.NOTIFICATIONS, JSON.stringify({ malformed: true }));
    assert.deepEqual(getNotificationsList(), INITIAL_NOTIFICATIONS);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('Demo authentication is unavailable outside development builds', () => {
  // Node (like a production bundle) has no import.meta.env.DEV; Vite replaces
  // the dev-only branch with false and strips the UI and handler.
  assert.equal(import.meta.env?.DEV, undefined);
  const result = loginAsDemoAccount('user-superadmin-1');
  assert.equal(result.ok, false);
  assert.match(result.message, /محیط توسعه/);
});

test('Notifications are isolated per user and hidden from guests', () => {
  const previousWindow = globalThis.window;
  const values = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    },
  };
  const signInAs = (userId) => {
    values.set(KEYS.SESSION, JSON.stringify({ userId, role: 'user', expiresAt: Date.now() + 60_000 }));
  };

  try {
    // Legacy global store still present, with records owned by different users.
    assert.equal(getNotificationsList().length, INITIAL_NOTIFICATIONS.length);

    signInAs('user-member-1');
    const memberIds = getNotifications().map((n) => n.id);
    assert.deepEqual(memberIds, ['notif-1', 'notif-2', 'notif-3', 'notif-4']);
    assert.equal(getUnreadCount(), 2);
    markNotificationRead('notif-2');
    assert.equal(getNotifications().find((n) => n.id === 'notif-2').read, true);

    signInAs('user-manager-1');
    const managerIds = getNotifications().map((n) => n.id);
    assert.deepEqual(managerIds, ['notif-1', 'notif-4']);
    assert.equal(managerIds.includes('notif-2'), false);
    // The member's read state must not leak into another account's store.
    assert.equal(getNotifications().find((n) => n.id === 'notif-1').read, false);

    values.delete(KEYS.SESSION);
    assert.deepEqual(getNotifications(), []);
    assert.equal(getUnreadCount(), 0);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('Admin RBAC: privileged sections are hidden from sub admins', () => {
  const superItems = getAdminNavItems('super_admin', []).map((n) => n.id);
  for (const id of ['analytics', 'activity_log', 'settings', 'announcements', 'users']) {
    assert.ok(superItems.includes(id), `super admin must see ${id}`);
  }

  const subDefaults = getAdminNavItems('sub_admin', ['clubs', 'reports', 'changes']).map((n) => n.id);
  for (const id of ['analytics', 'activity_log', 'settings', 'announcements', 'users', 'sports']) {
    assert.equal(subDefaults.includes(id), false, `sub admin must NOT see ${id}`);
  }
  assert.ok(subDefaults.includes('dashboard'));
  assert.ok(subDefaults.includes('reports'));
  assert.ok(subDefaults.includes('mgmt_requests')); // either users OR clubs permission

  const withAnalytics = getAdminNavItems('sub_admin', ['analytics']).map((n) => n.id);
  assert.ok(withAnalytics.includes('analytics'));
  assert.equal(withAnalytics.includes('activity_log'), false);

  // Direct section access checks (defense in depth behind hidden navigation).
  assert.equal(canAccessAdminSection('sub_admin', ['clubs'], 'analytics'), false);
  assert.equal(canAccessAdminSection('sub_admin', ['clubs'], 'activity_log'), false);
  assert.equal(canAccessAdminSection('sub_admin', ['all'], 'activity_log'), true);
  assert.equal(canAccessAdminSection('user', ['all'], 'analytics'), false);
  assert.equal(canAccessAdminSection('super_admin', [], 'activity_log'), true);
});

test('Search impressions count only explicit, new, non-empty searches', () => {
  assert.equal(isNewGenuineSearch('', ''), false);
  assert.equal(isNewGenuineSearch('   ', 'سجاد'), false);
  assert.equal(isNewGenuineSearch('سجاد', 'سجاد'), false);
  assert.equal(isNewGenuineSearch(' سجاد ', ''), true);
  assert.equal(isNewGenuineSearch('سجاد', 'احمدآباد'), true);

  const clubs = [
    { id: 'a', searchImpressions: 10 },
    { id: 'b', searchImpressions: 2 },
    { id: 'c' },
  ];
  const before = clubs.map((c) => ({ ...c }));
  assert.deepEqual(recordSearchImpressions(clubs, [], ''), clubs, 'empty query must be a no-op');
  assert.deepEqual(clubs, before, 'input must not be mutated');

  const after = recordSearchImpressions(clubs, ['a', 'c'], 'سجاد');
  assert.equal(after.find((c) => c.id === 'a').searchImpressions, 11);
  assert.equal(after.find((c) => c.id === 'b').searchImpressions, 2);
  assert.equal(after.find((c) => c.id === 'c').searchImpressions, 1);
  assert.equal(clubs[0].searchImpressions, 10, 'original list untouched');
});

test('Internal AI Studio prompts are not part of public assets', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  assert.equal(existsSync(resolve(root, 'dev-docs/aistudio/Paste_November_22__2026_-_10_19AM_4b710af6')), true);
  const publicAssets = resolve(root, 'public/assets');
  const leaked = existsSync(resolve(publicAssets, 'aistudio'));
  assert.equal(leaked, false, 'no aistudio/ folder may remain inside public/assets');
  assert.equal(existsSync(resolve(root, 'public/favicon.svg')), true, 'unrelated public assets must be preserved');
});
