/**
 * SPORTLINK — Admin section visibility (MVP UI gating only).
 *
 * IMPORTANT: This module only hides controls in the browser. It is NOT
 * authorization. Any user can call the underlying functions or edit
 * LocalStorage. A production backend must verify the role/permissions for
 * every request and never rely on hidden navigation.
 */

export const ADMIN_SECTIONS = [
  { id: 'dashboard', label: 'داشبورد', permission: null },
  { id: 'users', label: 'مدیریت کاربران', permission: 'users' },
  { id: 'clubs', label: 'مدیریت باشگاه‌ها', permission: 'clubs' },
  { id: 'sports', label: 'مدیریت رشته‌های ورزشی', permission: 'sports' },
  { id: 'club_requests', label: 'درخواست‌های ثبت باشگاه', permission: 'clubs' },
  { id: 'mgmt_requests', label: 'درخواست‌های مدیریت', permission: ['users', 'clubs'] },
  { id: 'changes', label: 'بررسی تغییرات اطلاعات', permission: 'changes' },
  { id: 'reports', label: 'گزارش‌های کاربران', permission: 'reports' },
  { id: 'announcements', label: 'اعلان‌ها و اطلاعیه‌های رسمی', permission: 'announcements' },
  { id: 'analytics', label: 'گزارش‌ها و آمار', permission: 'analytics' },
  { id: 'settings', label: 'تنظیمات عمومی و دسترسی مدیران', permission: 'settings' },
  { id: 'activity_log', label: 'گزارش فعالیت مدیران', permission: 'activity_log' },
];

export function canAccessAdminSection(role, permissions, permission) {
  if (role === 'super_admin') return true;
  if (role !== 'sub_admin') return false;
  if (!permission) return true;

  const granted = Array.isArray(permissions) ? permissions : [];
  if (granted.includes('all')) return true;
  const required = Array.isArray(permission) ? permission : [permission];
  return required.some((key) => granted.includes(key));
}

export function getAdminNavItems(role, permissions) {
  return ADMIN_SECTIONS
    .filter((section) => canAccessAdminSection(role, permissions, section.permission))
    .map(({ id, label }) => ({ id, label }));
}
