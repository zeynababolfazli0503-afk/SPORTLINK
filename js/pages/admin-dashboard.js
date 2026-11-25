/**
 * SPORTLINK — Main Admin Dashboard Controller
 * Accessible ONLY to super_admin or sub_admin, else 403.
 * Supports: Dashboard KPIs + Excel(CSV) export, Users, Clubs (direct add & publish),
 * Sports, Club Registration Requests, Management Requests, Change Requests,
 * Reports, Official Broadcast Notifications, Settings, Sub-admin RBAC, Activity Log.
 *
 * SECURITY NOTE: Section visibility below is client-side UI gating only, not
 * authorization. A production backend must enforce RBAC on every API call.
 */

import { getCurrentUser, isAdminRole } from '../auth.js';
import {
  getUsers,
  saveUsers,
  getClubs,
  saveClubs,
  getSportsList,
  saveSportsList,
  getManagementRequests,
  saveManagementRequests,
  getChangeRequests,
  saveChangeRequests,
  getReports,
  saveReports,
  getActivityLogs,
  appendActivityLog,
  getSettings,
  saveSettings,
  getCurrentJalaliDate,
} from '../storage.js';
import { MASHHAD_NEIGHBORHOODS, CLUB_TYPES, CATEGORIES, IMAGES, formatNumberFa } from '../data.js';
import { pushNotification } from '../notifications.js';
import { requireAuthOrRedirect, redirectTo403 } from '../router.js';
import { canAccessAdminSection, getAdminNavItems } from '../admin-rbac.js';
import { escapeHtml, escapeCsvCell, showToast, openModal } from '../components/ui.js';

export function initAdminDashboardPage() {
  const user = getCurrentUser();
  if (!user) {
    requireAuthOrRedirect();
    return;
  }
  if (!isAdminRole(user)) {
    redirectTo403();
    return;
  }

  const root = document.getElementById('admin-dashboard-root');
  if (!root) return;

  const isSuper = user.role === 'super_admin';
  const permissions = isSuper ? ['all'] : user.permissions || ['clubs', 'reports', 'changes'];
  const canAccess = (perm) => canAccessAdminSection(user.role, permissions, perm);

  let activeTab = 'dashboard';

  // Privileged sections are no longer always visible. Sub admins only see the
  // sections granted by their permissions; analytics/activity log are privileged.
  const navItems = getAdminNavItems(user.role, permissions);
  const allowedTabIds = new Set(navItems.map((n) => n.id));
  // Defense in depth: a manipulated tab id must not render a hidden section.
  if (!allowedTabIds.has(activeTab)) activeTab = 'dashboard';

  const exportExcelCsv = (filename, headers, rows) => {
    const csvLines = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((r) => r.map(escapeCsvCell).join(',')),
    ];
    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ type: 'success', message: 'فایل گزارش Excel (CSV) دانلود شد.' });
  };

  const render = () => {
    const users = getUsers();
    const clubs = getClubs();
    const publishedClubs = clubs.filter((c) => c.status === 'published');
    const pendingClubs = clubs.filter((c) => c.status === 'pending');
    const mgmtReqs = getManagementRequests();
    const changeReqs = getChangeRequests();
    const reports = getReports();
    const totalViews = clubs.reduce((acc, c) => acc + (c.viewsCount || 0), 0);

    root.innerHTML = `
      <div class="container">
        <div class="workspace-shell">
          <aside class="workspace-sidebar" aria-label="منوی پنل مدیریت SPORTLINK">
            <div style="padding:0.5rem 0.75rem 1rem;border-bottom:1px solid var(--border-subtle);margin-bottom:0.75rem;">
              <div style="font-weight:700;">${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</div>
              <div style="font-size:0.8125rem;color:var(--accent-gold);">${isSuper ? 'Super Admin (دسترسی کامل)' : 'Sub Admin (دسترسی محدود)'}</div>
            </div>
            <nav class="workspace-nav">
              ${navItems
                .map(
                  (item) => `
                  <button type="button" class="workspace-nav-btn js-adm-tab ${activeTab === item.id ? 'is-active' : ''}" data-tab="${item.id}">
                    <span>${escapeHtml(item.label)}</span>
                  </button>
                `
                )
                .join('')}
            </nav>
          </aside>

          <section class="workspace-content" id="adm-tab-body"></section>
        </div>
      </div>
    `;

    root.querySelectorAll('.js-adm-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextTab = btn.dataset.tab;
        activeTab = allowedTabIds.has(nextTab) ? nextTab : 'dashboard';
        render();
      });
    });

    const bodyEl = document.getElementById('adm-tab-body');
    if (!bodyEl) return;

    if (activeTab === 'dashboard') {
      // Sensitive preview/export must follow the same permission as the Reports tab.
      const canViewReports = canAccess('reports');
      const exportButtonHtml = canViewReports
        ? '<button type="button" class="btn btn-primary btn-sm" id="adm-export-dashboard">خروجی Excel گزارش کل</button>'
        : '';
      const reportPreviewHtml = canViewReports
        ? `
        <div class="card">
          <h3 style="font-size:1.05rem;">وضعیت گزارش‌های کاربران</h3>
          <div class="table-wrap">
            <table class="data-table table-responsive-cards">
              <thead><tr><th>باشگاه</th><th>دسته‌بندی</th><th>وضعیت</th><th>تاریخ</th></tr></thead>
              <tbody>
                ${reports
                  .slice(0, 5)
                  .map(
                    (r) => `
                    <tr>
                      <td data-label="باشگاه">${escapeHtml(r.clubName)}</td>
                      <td data-label="دسته‌بندی">${escapeHtml(r.category)}</td>
                      <td data-label="وضعیت">${escapeHtml(r.status)}</td>
                      <td data-label="تاریخ" class="tabular-nums">${escapeHtml(r.submittedAtJalali)}</td>
                    </tr>
                  `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>`
        : '';
      bodyEl.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;margin-bottom:1.25rem;">
          <h2 style="margin:0;font-size:1.25rem;">نمای کلی پلتفرم SPORTLINK (مشهد)</h2>
          ${exportButtonHtml}
        </div>

        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-label">تعداد کاربران</div><div class="kpi-value">${formatNumberFa(users.length)}</div></div>
          <div class="kpi-card"><div class="kpi-label">باشگاه‌های منتشرشده</div><div class="kpi-value">${formatNumberFa(publishedClubs.length)}</div></div>
          <div class="kpi-card"><div class="kpi-label">باشگاه‌های در انتظار تأیید</div><div class="kpi-value">${formatNumberFa(pendingClubs.length)}</div></div>
          <div class="kpi-card"><div class="kpi-label">مجموع بازدیدها</div><div class="kpi-value">${formatNumberFa(totalViews)}</div></div>
          <div class="kpi-card"><div class="kpi-label">درخواست‌های ثبت باشگاه</div><div class="kpi-value">${formatNumberFa(pendingClubs.length)}</div></div>
          <div class="kpi-card"><div class="kpi-label">درخواست‌های مدیریت</div><div class="kpi-value">${formatNumberFa(mgmtReqs.length)}</div></div>
          <div class="kpi-card"><div class="kpi-label">گزارش‌های کاربران</div><div class="kpi-value">${formatNumberFa(reports.length)}</div></div>
          <div class="kpi-card"><div class="kpi-label">تغییرات در انتظار تأیید</div><div class="kpi-value">${formatNumberFa(changeReqs.filter((r) => r.status === 'در انتظار بررسی').length)}</div></div>
        </div>

        ${reportPreviewHtml}
      `;

      if (canViewReports) document.getElementById('adm-export-dashboard')?.addEventListener('click', () => {
        exportExcelCsv(
          'sportlink-mashhad-summary.csv',
          ['نام باشگاه', 'محله', 'نوع', 'وضعیت', 'بازدید', 'نمایش جستجو', 'کلیک تماس'],
          clubs.map((c) => [c.name, c.neighborhood, c.type, c.status, c.viewsCount, c.searchImpressions, c.phoneClicks])
        );
      });
    } else if (activeTab === 'users') {
      bodyEl.innerHTML = `
        <div class="card">
          <h2 style="font-size:1.2rem;">مدیریت کاربران</h2>
          <div class="table-wrap">
            <table class="data-table table-responsive-cards">
              <thead><tr><th>نام و نام خانوادگی</th><th>موبایل</th><th>ایمیل</th><th>نقش</th><th>وضعیت</th><th>عملیات</th></tr></thead>
              <tbody>
                ${users
                  .map(
                    (u) => `
                    <tr>
                      <td data-label="نام">${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}</td>
                      <td data-label="موبایل" class="tabular-nums">${escapeHtml(u.mobile)}</td>
                      <td data-label="ایمیل" class="en-wordmark">${escapeHtml(u.email)}</td>
                      <td data-label="نقش">${escapeHtml(u.role)}</td>
                      <td data-label="وضعیت">${u.active !== false ? 'فعال' : 'غیرفعال'}</td>
                      <td data-label="عملیات">
                        ${
                          u.role === 'super_admin'
                            ? '—'
                            : `<button type="button" class="btn btn-secondary btn-sm js-toggle-user" data-id="${escapeHtml(u.id)}">${u.active !== false ? 'تعلیق' : 'فعال‌سازی'}</button>`
                        }
                      </td>
                    </tr>
                  `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      bodyEl.querySelectorAll('.js-toggle-user').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const next = users.map((u) => (u.id === id ? { ...u, active: u.active === false } : u));
          saveUsers(next);
          appendActivityLog(`${user.firstName} ${user.lastName}`, 'تغییر وضعیت حساب کاربر', id);
          showToast({ type: 'success', message: 'وضعیت کاربر به‌روزرسانی شد.' });
          render();
        });
      });
    } else if (activeTab === 'clubs') {
      bodyEl.innerHTML = `
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;margin-bottom:1rem;">
            <h2 style="margin:0;font-size:1.2rem;">مدیریت باشگاه‌های مشهد</h2>
            <button type="button" class="btn btn-primary btn-sm" id="adm-direct-add-club">ثبت مستقیم باشگاه توسط SPORTLINK</button>
          </div>
          <div class="table-wrap">
            <table class="data-table table-responsive-cards">
              <thead><tr><th>نام باشگاه</th><th>محله</th><th>نوع</th><th>وضعیت انتشار</th><th>عملیات</th></tr></thead>
              <tbody>
                ${clubs
                  .map(
                    (c) => `
                    <tr>
                      <td data-label="نام">${escapeHtml(c.name)}</td>
                      <td data-label="محله">${escapeHtml(c.neighborhood)}</td>
                      <td data-label="نوع">${escapeHtml(c.type)}</td>
                      <td data-label="وضعیت">
                        <span class="status-label ${c.status === 'published' ? 'is-approved' : 'is-pending'}">${c.status === 'published' ? 'منتشرشده' : 'در انتظار تأیید'}</span>
                      </td>
                      <td data-label="عملیات">
                        <button type="button" class="btn btn-secondary btn-sm js-toggle-club-pub" data-id="${escapeHtml(c.id)}">
                          ${c.status === 'published' ? 'توقف انتشار' : 'تأیید و انتشار'}
                        </button>
                      </td>
                    </tr>
                  `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      bodyEl.querySelectorAll('.js-toggle-club-pub').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cid = btn.dataset.id;
          const target = clubs.find((c) => c.id === cid);
          const nextStatus = target?.status === 'published' ? 'pending' : 'published';
          saveClubs(clubs.map((c) => (c.id === cid ? { ...c, status: nextStatus } : c)));
          appendActivityLog(`${user.firstName} ${user.lastName}`, `تغییر وضعیت انتشار باشگاه به ${nextStatus}`, cid);
          showToast({ type: 'success', message: 'وضعیت انتشار باشگاه تغییر یافت.' });
          render();
        });
      });

      document.getElementById('adm-direct-add-club')?.addEventListener('click', () => {
        const { dialog, close } = openModal({
          title: 'ثبت مستقیم باشگاه در مشهد',
          bodyHtml: `
            <form id="adm-new-club-form" class="form-stack">
              <div class="form-group">
                <label class="form-label" for="an-name">نام باشگاه</label>
                <input type="text" id="an-name" class="form-control" required />
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label" for="an-hood">محله</label>
                  <select id="an-hood" class="form-select">${MASHHAD_NEIGHBORHOODS.map((h) => `<option value="${h}">${h}</option>`).join('')}</select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="an-type">نوع مجموعه</label>
                  <select id="an-type" class="form-select">${CLUB_TYPES.map((t) => `<option value="${t}">${t}</option>`).join('')}</select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="an-addr">آدرس دقیق</label>
                <input type="text" id="an-addr" class="form-control" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="an-phone">شماره تماس</label>
                <input type="text" id="an-phone" class="form-control" required />
              </div>
              <div class="modal-actions" style="margin-top:0;">
                <button type="button" class="btn btn-ghost" id="an-cancel">انصراف</button>
                <button type="submit" class="btn btn-primary">ثبت و انتشار</button>
              </div>
            </form>
          `,
        });
        dialog.querySelector('#an-cancel')?.addEventListener('click', close);
        dialog.querySelector('#adm-new-club-form')?.addEventListener('submit', (e) => {
          e.preventDefault();
          const name = dialog.querySelector('#an-name').value.trim();
          const hood = dialog.querySelector('#an-hood').value;
          const type = dialog.querySelector('#an-type').value;
          const addr = dialog.querySelector('#an-addr').value.trim();
          const phone = dialog.querySelector('#an-phone').value.trim();
          if (!name || !addr || !phone) return;
          const newClub = {
            id: `club-adm-${Date.now()}`,
            slug: `club-${Date.now()}`,
            name,
            type,
            city: 'مشهد',
            neighborhood: hood,
            shortAddress: addr,
            fullAddress: `مشهد، ${addr}`,
            locationHint: '',
            shortDescription: 'ثبت‌شده توسط تیم محتوای SPORTLINK.',
            description: 'اطلاعات ثبت‌شده و تأییدشده توسط تیم مدیریت SPORTLINK در شهر مشهد.',
            sports: ['bodybuilding'],
            facilities: ['locker', 'shower', 'ac'],
            images: [IMAGES.hero],
            hours: {
              sat: { open: '07:00', close: '22:30', note: '' },
              sun: { open: '07:00', close: '22:30', note: '' },
              mon: { open: '07:00', close: '22:30', note: '' },
              tue: { open: '07:00', close: '22:30', note: '' },
              wed: { open: '07:00', close: '22:30', note: '' },
              thu: { open: '08:00', close: '21:00', note: '' },
              fri: { open: 'closed', close: 'closed', note: 'تعطیل' },
            },
            priceInfo: { hasPrice: false, label: 'استعلام قیمت' },
            phone,
            website: '',
            social: { instagram: '', telegram: '' },
            managerName: '',
            status: 'published',
            isFeatured: false,
            updatedAtJalali: getCurrentJalaliDate(),
            createdAtOrder: clubs.length + 1,
            viewsCount: 0,
            searchImpressions: 0,
            phoneClicks: 0,
          };
          saveClubs([newClub, ...clubs]);
          appendActivityLog(`${user.firstName} ${user.lastName}`, `ثبت مستقیم باشگاه «${name}»`, newClub.id);
          close();
          showToast({ type: 'success', message: 'باشگاه جدید ثبت و منتشر شد.' });
          render();
        });
      });
    } else if (activeTab === 'sports') {
      const sportsList = getSportsList();
      bodyEl.innerHTML = `
        <div class="card">
          <h2 style="font-size:1.2rem;">مدیریت رشته‌های ورزشی (${formatNumberFa(sportsList.length)} رشته)</h2>
          <div class="table-wrap">
            <table class="data-table table-responsive-cards">
              <thead><tr><th>نام رشته</th><th>دسته‌بندی</th><th>خلاصه</th></tr></thead>
              <tbody>
                ${sportsList
                  .map((sp) => {
                    const cat = CATEGORIES.find((c) => c.id === sp.categoryId);
                    return `
                      <tr>
                        <td data-label="رشته">${escapeHtml(sp.name)}</td>
                        <td data-label="دسته">${escapeHtml(cat ? cat.name : sp.categoryId)}</td>
                        <td data-label="خلاصه">${escapeHtml(sp.shortSummary)}</td>
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (activeTab === 'club_requests') {
      bodyEl.innerHTML = `
        <div class="card">
          <h2 style="font-size:1.2rem;">درخواست‌های ثبت باشگاه</h2>
          ${
            pendingClubs.length === 0
              ? '<p style="color:var(--text-muted);margin:0;">درخواست ثبت باشگاه جدیدی در انتظار بررسی نیست.</p>'
              : `<div class="form-stack">
                  ${pendingClubs
                    .map(
                      (c) => `
                      <div class="notif-item">
                        <div>
                          <strong>${escapeHtml(c.name)}</strong>
                          <div class="meta-inline"><span>${escapeHtml(c.type)}</span><span>·</span><span>محله ${escapeHtml(c.neighborhood)}</span></div>
                          <p style="margin:0.4rem 0 0;font-size:0.875rem;color:var(--text-muted);">${escapeHtml(c.fullAddress)}</p>
                        </div>
                        <div style="display:flex;gap:0.5rem;">
                          <button type="button" class="btn btn-primary btn-sm js-approve-club" data-id="${escapeHtml(c.id)}">تأیید و انتشار</button>
                          <button type="button" class="btn btn-danger btn-sm js-reject-club" data-id="${escapeHtml(c.id)}">رد درخواست</button>
                        </div>
                      </div>
                    `
                    )
                    .join('')}
                </div>`
          }
        </div>
      `;

      bodyEl.querySelectorAll('.js-approve-club').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cid = btn.dataset.id;
          const target = clubs.find((c) => c.id === cid);
          saveClubs(clubs.map((c) => (c.id === cid ? { ...c, status: 'published', updatedAtJalali: getCurrentJalaliDate() } : c)));
          appendActivityLog(`${user.firstName} ${user.lastName}`, `تأیید و انتشار باشگاه «${target?.name}»`, cid);
          pushNotification({
            type: 'تغییر وضعیت درخواست ثبت باشگاه',
            title: `باشگاه «${target?.name}» منتشر شد`,
            message: 'درخواست ثبت مجموعه پس از بررسی تأیید شد و اکنون در دایرکتوری مشهد قابل مشاهده است.',
            link: `/pages/club-detail.html?id=${encodeURIComponent(cid)}`,
          });
          showToast({ type: 'success', message: 'باشگاه تأیید و در دایرکتوری منتشر شد.' });
          render();
        });
      });

      bodyEl.querySelectorAll('.js-reject-club').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cid = btn.dataset.id;
          const target = clubs.find((c) => c.id === cid);
          saveClubs(clubs.filter((c) => c.id !== cid));
          appendActivityLog(`${user.firstName} ${user.lastName}`, `رد درخواست ثبت باشگاه «${target?.name}»`, cid);
          showToast({ type: 'info', message: 'درخواست ثبت باشگاه رد و حذف شد.' });
          render();
        });
      });
    } else if (activeTab === 'mgmt_requests') {
      bodyEl.innerHTML = `
        <div class="card">
          <h2 style="font-size:1.2rem;">درخواست‌های مدیریت باشگاه</h2>
          <div class="form-stack">
            ${mgmtReqs
              .map(
                (r) => `
                <article class="notif-item">
                  <div>
                    <div class="meta-inline">
                      <span>${escapeHtml(r.clubName)}</span>
                      <span class="meta-sep">·</span>
                      <span>${escapeHtml(r.firstName)} ${escapeHtml(r.lastName)}</span>
                      <span class="meta-sep">·</span>
                      <span class="status-label ${r.status === 'تأیید شده' ? 'is-approved' : r.status === 'رد شده' ? 'is-rejected' : 'is-pending'}">${escapeHtml(r.status)}</span>
                    </div>
                    <div style="font-size:0.8125rem;color:var(--text-muted);margin-top:0.35rem;">مدرک: ${escapeHtml(r.documentName)}</div>
                    ${r.reason ? `<div style="font-size:0.8125rem;color:#fca5a5;margin-top:0.35rem;">دلیل: ${escapeHtml(r.reason)}</div>` : ''}
                  </div>
                  <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <button type="button" class="btn btn-primary btn-sm js-mr-act" data-id="${escapeHtml(r.id)}" data-status="تأیید شده">تأیید</button>
                    <button type="button" class="btn btn-secondary btn-sm js-mr-act" data-id="${escapeHtml(r.id)}" data-status="نیازمند اصلاح">نیازمند اصلاح</button>
                    <button type="button" class="btn btn-danger btn-sm js-mr-act" data-id="${escapeHtml(r.id)}" data-status="رد شده">رد</button>
                  </div>
                </article>
              `
              )
              .join('')}
          </div>
        </div>
      `;

      bodyEl.querySelectorAll('.js-mr-act').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const nextStatus = btn.dataset.status;
          let reason = '';
          if (nextStatus === 'نیازمند اصلاح' || nextStatus === 'رد شده') {
            reason = 'لطفاً مدرک معتبر مالکیت یا معرفی‌نامه رسمی با مهر مجموعه بارگذاری شود.';
          }
          const target = mgmtReqs.find((r) => r.id === id);
          saveManagementRequests(mgmtReqs.map((r) => (r.id === id ? { ...r, status: nextStatus, reason } : r)));
          if (nextStatus === 'تأیید شده' && target?.userId && target?.clubId) {
            saveUsers(users.map((u) => (u.id === target.userId ? { ...u, role: 'manager', managedClubId: target.clubId } : u)));
          }
          appendActivityLog(`${user.firstName} ${user.lastName}`, `تغییر وضعیت درخواست مدیریت ${id} به ${nextStatus}`, id);
          if (target?.userId) {
            pushNotification({
              type: 'تغییر وضعیت درخواست مدیریت',
              title: `وضعیت درخواست مدیریت «${target?.clubName}»: ${nextStatus}`,
              message: reason || 'درخواست مدیریت شما بررسی و به‌روزرسانی شد.',
              link: '/pages/management-request.html',
              userId: target.userId,
            });
          }
          showToast({ type: 'success', message: `وضعیت درخواست به «${nextStatus}» تغییر یافت.` });
          render();
        });
      });
    } else if (activeTab === 'changes') {
      bodyEl.innerHTML = `
        <div class="card">
          <h2 style="font-size:1.2rem;">بررسی تغییرات اطلاعات باشگاه‌ها</h2>
          <div class="form-stack">
            ${changeReqs
              .map(
                (r) => `
                <div class="notif-item">
                  <div>
                    <div class="meta-inline">
                      <span>${escapeHtml(r.clubName)}</span>
                      <span class="meta-sep">·</span>
                      <span>${escapeHtml(r.fieldLabel)}</span>
                      <span class="meta-sep">·</span>
                      <span class="status-label ${r.status === 'تأیید شده' ? 'is-approved' : r.status === 'رد شده' ? 'is-rejected' : 'is-pending'}">${escapeHtml(r.status)}</span>
                    </div>
                    <div style="font-size:0.875rem;margin-top:0.35rem;">مقدار جدید: <strong>${escapeHtml(r.newValue)}</strong></div>
                  </div>
                  ${
                    r.status === 'در انتظار بررسی'
                      ? `<div style="display:flex;gap:0.5rem;">
                           <button type="button" class="btn btn-primary btn-sm js-cr-act" data-id="${escapeHtml(r.id)}" data-status="تأیید شده">تأیید و اعمال</button>
                           <button type="button" class="btn btn-danger btn-sm js-cr-act" data-id="${escapeHtml(r.id)}" data-status="رد شده">رد</button>
                         </div>`
                      : ''
                  }
                </div>
              `
              )
              .join('')}
          </div>
        </div>
      `;

      bodyEl.querySelectorAll('.js-cr-act').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const nextStatus = btn.dataset.status;
          const target = changeReqs.find((r) => r.id === id);
          saveChangeRequests(changeReqs.map((r) => (r.id === id ? { ...r, status: nextStatus } : r)));
          if (nextStatus === 'تأیید شده' && target) {
            saveClubs(
              clubs.map((c) => {
                if (c.id !== target.clubId) return c;
                if (target.field === 'priceInfo') {
                  return { ...c, priceInfo: { ...c.priceInfo, hasPrice: true, label: target.newValue } };
                }
                if (target.field === 'name' || target.field === 'fullAddress' || target.field === 'phone') {
                  return { ...c, [target.field]: target.newValue };
                }
                return c;
              })
            );
          }
          appendActivityLog(`${user.firstName} ${user.lastName}`, `تغییر وضعیت درخواست ویرایش ${id} به ${nextStatus}`, id);
          showToast({ type: 'success', message: `درخواست تغییر اطلاعات ${nextStatus}.` });
          render();
        });
      });
    } else if (activeTab === 'reports') {
      bodyEl.innerHTML = `
        <div class="card">
          <h2 style="font-size:1.2rem;">گزارش‌های مشکلات کاربران</h2>
          <div class="form-stack">
            ${reports
              .map(
                (r) => `
                <article class="notif-item">
                  <div style="flex:1;">
                    <div class="meta-inline">
                      <span>${escapeHtml(r.clubName)}</span>
                      <span class="meta-sep">·</span>
                      <span>${escapeHtml(r.category)}</span>
                      <span class="meta-sep">·</span>
                      <span class="status-label ${r.status === 'رسیدگی‌شده' ? 'is-approved' : r.status === 'ردشده' ? 'is-rejected' : 'is-pending'}">${escapeHtml(r.status)}</span>
                    </div>
                    <p style="margin:0.4rem 0;font-size:0.875rem;">${escapeHtml(r.description)}</p>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem;">
                      <select class="form-select js-rep-status" data-id="${escapeHtml(r.id)}" aria-label="تغییر وضعیت گزارش ${escapeHtml(r.clubName)}" style="width:auto;min-height:36px;">
                        ${['ثبت‌شده', 'در حال بررسی', 'نیازمند اطلاعات بیشتر', 'رسیدگی‌شده', 'ردشده'].map((s) => `<option value="${s}" ${r.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                      </select>
                      <input type="text" class="form-control js-rep-reply" data-id="${escapeHtml(r.id)}" value="${escapeHtml(r.adminReply || '')}" placeholder="پاسخ کارشناس به کاربر..." aria-label="پاسخ کارشناس به گزارش ${escapeHtml(r.clubName)}" style="max-width:300px;min-height:36px;" />
                      <button type="button" class="btn btn-primary btn-sm js-rep-save" data-id="${escapeHtml(r.id)}">ثبت پاسخ</button>
                    </div>
                  </div>
                </article>
              `
              )
              .join('')}
          </div>
        </div>
      `;

      bodyEl.querySelectorAll('.js-rep-save').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const reportCard = btn.closest('.notif-item');
          const st = reportCard?.querySelector('.js-rep-status')?.value;
          const rep = reportCard?.querySelector('.js-rep-reply')?.value.trim();
          const target = reports.find((r) => r.id === id);
          saveReports(reports.map((r) => (r.id === id ? { ...r, status: st, adminReply: rep } : r)));
          appendActivityLog(`${user.firstName} ${user.lastName}`, `رسیدگی به گزارش ${id} (${st})`, id);
          if (target?.userId) {
            pushNotification({
              type: 'تغییر وضعیت گزارش',
              title: `وضعیت گزارش «${target?.clubName}»: ${st}`,
              message: rep || 'وضعیت گزارش شما توسط تیم پشتیبانی بررسی شد.',
              link: '/pages/report.html',
              userId: target.userId,
            });
          }
          showToast({ type: 'success', message: 'وضعیت و پاسخ گزارش ثبت شد.' });
          render();
        });
      });
    } else if (activeTab === 'announcements') {
      bodyEl.innerHTML = `
        <div class="card">
          <h2 style="font-size:1.2rem;">ارسال اطلاعیه رسمی SPORTLINK</h2>
          <p style="font-size:0.875rem;color:var(--text-muted);">در نسخه MVP اطلاعیه‌های رسمی به‌صورت عمومی برای همه کاربران ارسال می‌شوند.</p>
          <form id="adm-broadcast-form" class="form-stack" style="max-width:540px;">
            <div class="form-group">
              <label class="form-label" for="bc-title">عنوان اطلاعیه</label>
              <input type="text" id="bc-title" class="form-control" required placeholder="مثلاً به‌روزرسانی ساعات زمستانی مجموعه‌ها" />
            </div>
            <div class="form-group">
              <label class="form-label" for="bc-msg">متن اطلاعیه</label>
              <textarea id="bc-msg" class="form-textarea" required></textarea>
            </div>
            <div><button type="submit" class="btn btn-primary">ارسال همگانی اطلاعیه</button></div>
          </form>
        </div>
      `;
      document.getElementById('adm-broadcast-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('bc-title').value.trim();
        const message = document.getElementById('bc-msg').value.trim();
        if (!title || !message) return;
        pushNotification({
          type: 'اطلاعیه‌های رسمی SPORTLINK',
          title,
          message,
          link: '/pages/notifications.html',
        });
        appendActivityLog(`${user.firstName} ${user.lastName}`, `ارسال اطلاعیه رسمی: ${title}`);
        showToast({ type: 'success', message: 'اطلاعیه رسمی برای همه کاربران منتشر شد.' });
        e.target.reset();
      });
    } else if (activeTab === 'analytics' && canAccess('analytics')) {
      bodyEl.innerHTML = `
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;margin-bottom:1rem;">
            <h2 style="margin:0;font-size:1.2rem;">گزارش‌ها و آمار پلتفرم</h2>
            <button type="button" class="btn btn-primary btn-sm" id="adm-export-stats">خروجی Excel آمار باشگاه‌ها</button>
          </div>
          <div class="table-wrap">
            <table class="data-table table-responsive-cards">
              <thead><tr><th>باشگاه</th><th>محله</th><th>بازدید صفحه</th><th>نمایش جست‌وجو</th><th>کلیک تماس</th></tr></thead>
              <tbody>
                ${publishedClubs
                  .map(
                    (c) => `
                    <tr>
                      <td data-label="باشگاه">${escapeHtml(c.name)}</td>
                      <td data-label="محله">${escapeHtml(c.neighborhood)}</td>
                      <td data-label="بازدید" class="tabular-nums">${formatNumberFa(c.viewsCount)}</td>
                      <td data-label="جست‌وجو" class="tabular-nums">${formatNumberFa(c.searchImpressions)}</td>
                      <td data-label="تماس" class="tabular-nums">${formatNumberFa(c.phoneClicks)}</td>
                    </tr>
                  `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
      document.getElementById('adm-export-stats')?.addEventListener('click', () => {
        exportExcelCsv(
          'sportlink-clubs-analytics.csv',
          ['باشگاه', 'محله', 'بازدید صفحه', 'نمایش در جستجو', 'کلیک شماره تماس'],
          publishedClubs.map((c) => [c.name, c.neighborhood, c.viewsCount, c.searchImpressions, c.phoneClicks])
        );
      });
    } else if (activeTab === 'settings') {
      const settings = getSettings();
      const subAdmins = users.filter((u) => u.role === 'sub_admin');

      bodyEl.innerHTML = `
        <div class="form-stack">
          <div class="card">
            <h2 style="font-size:1.2rem;">تنظیمات عمومی پلتفرم</h2>
            <form id="adm-settings-form" class="form-stack" style="max-width:540px;">
              <div class="form-group">
                <label class="form-label" for="set-notice">پیام اطلاع‌رسانی پلتفرم</label>
                <input type="text" id="set-notice" class="form-control" value="${escapeHtml(settings.siteNotice)}" />
              </div>
              <div class="form-group">
                <label class="form-label" for="set-timeout">مدت انقضای نشست عدم فعالیت (دقیقه)</label>
                <input type="number" id="set-timeout" class="form-control tabular-nums" min="5" max="120" value="${Number(settings.sessionTimeoutMinutes || 30)}" />
              </div>
              <label class="check-item">
                <input type="checkbox" id="set-allow-reg" ${settings.allowClubRegistration ? 'checked' : ''} />
                <span>امکان ثبت درخواست باشگاه جدید فعال باشد</span>
              </label>
              <div><button type="submit" class="btn btn-primary">ذخیره تنظیمات</button></div>
            </form>
          </div>

          <div class="card">
            <h2 style="font-size:1.2rem;">تعیین و تغییر دسترسی مدیران فرعی (Super Admin)</h2>
            ${subAdmins
              .map(
                (sa) => `
                <div class="notif-item" style="margin-top:0.75rem;">
                  <div>
                    <strong>${escapeHtml(sa.firstName)} ${escapeHtml(sa.lastName)}</strong>
                    <div class="meta-inline"><span>${escapeHtml(sa.email)}</span></div>
                    <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-top:0.6rem;">
                      ${[
                        ['clubs', 'مدیریت باشگاه‌ها'],
                        ['reports', 'بررسی گزارش‌ها'],
                        ['changes', 'بررسی تغییرات'],
                        ['users', 'مدیریت کاربران'],
                        ['sports', 'مدیریت رشته‌ها'],
                      ]
                        .map(
                          ([pKey, pLabel]) => `
                          <label class="check-item">
                            <input type="checkbox" class="js-sa-perm" data-uid="${escapeHtml(sa.id)}" value="${pKey}" ${(sa.permissions || []).includes(pKey) ? 'checked' : ''} />
                            <span>${pLabel}</span>
                          </label>
                        `
                        )
                        .join('')}
                    </div>
                  </div>
                  <button type="button" class="btn btn-secondary btn-sm js-sa-save" data-uid="${escapeHtml(sa.id)}">ذخیره دسترسی</button>
                </div>
              `
              )
              .join('')}
          </div>
        </div>
      `;

      document.getElementById('adm-settings-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveSettings({
          ...settings,
          siteNotice: document.getElementById('set-notice').value.trim(),
          sessionTimeoutMinutes: parseInt(document.getElementById('set-timeout').value, 10) || 30,
          allowClubRegistration: document.getElementById('set-allow-reg').checked,
        });
        appendActivityLog(`${user.firstName} ${user.lastName}`, 'به‌روزرسانی تنظیمات عمومی پلتفرم');
        showToast({ type: 'success', message: 'تنظیمات عمومی ذخیره شد.' });
      });

      bodyEl.querySelectorAll('.js-sa-save').forEach((btn) => {
        btn.addEventListener('click', () => {
          const uid = btn.dataset.uid;
          const nextPerms = Array.from(bodyEl.querySelectorAll('.js-sa-perm'))
            .filter((el) => el.dataset.uid === uid && el.checked)
            .map((el) => el.value);
          saveUsers(users.map((u) => (u.id === uid ? { ...u, permissions: nextPerms } : u)));
          appendActivityLog(`${user.firstName} ${user.lastName}`, `تغییر دسترسی‌های مدیر فرعی ${uid}`, uid);
          showToast({ type: 'success', message: 'سطح دسترسی مدیر فرعی به‌روزرسانی شد.' });
        });
      });
    } else if (activeTab === 'activity_log' && canAccess('activity_log')) {
      const logs = getActivityLogs();
      bodyEl.innerHTML = `
        <div class="card">
          <h2 style="font-size:1.2rem;">گزارش فعالیت مدیران</h2>
          <div class="table-wrap">
            <table class="data-table table-responsive-cards">
              <thead><tr><th>مدیر</th><th>عملیات</th><th>زمان</th></tr></thead>
              <tbody>
                ${logs
                  .map(
                    (l) => `
                    <tr>
                      <td data-label="مدیر">${escapeHtml(l.actorName)}</td>
                      <td data-label="عملیات">${escapeHtml(l.action)}</td>
                      <td data-label="زمان" class="tabular-nums">${escapeHtml(l.timestampJalali)}</td>
                    </tr>
                  `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  };

  render();
}
