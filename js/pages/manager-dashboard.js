/**
 * SPORTLINK — Club Manager Dashboard Controller
 * Accessible ONLY to verified club managers (role === 'manager' && managedClubId).
 * - Minor edits (description, sports, facilities, hours, images) publish immediately.
 * - Critical edits (name, address, phone, price, custom facility) create pending ClubChangeRequests.
 * - Analytics: aggregated page views, search impressions, phone clicks only (never visitor identity).
 */

import { getCurrentUser, isManagerRole } from '../auth.js';
import {
  getClubs,
  saveClubs,
  getSportsList,
  getChangeRequests,
  saveChangeRequests,
  getCurrentJalaliDate,
} from '../storage.js';
import { FACILITIES, ANALYTICS_SERIES, IMAGES, formatNumberFa } from '../data.js';
import { requireAuthOrRedirect, redirectTo403 } from '../router.js';
import { pushNotification } from '../notifications.js';
import { escapeHtml, showToast } from '../components/ui.js';

export function initManagerDashboardPage() {
  const user = getCurrentUser();
  if (!user) {
    requireAuthOrRedirect();
    return;
  }
  if (!isManagerRole(user)) {
    redirectTo403();
    return;
  }

  const root = document.getElementById('manager-dashboard-root');
  if (!root) return;

  let activeTab = 'overview';
  let analyticsPeriod = 'daily';
  let editHistory = [
    { id: 'eh-1', detail: 'به‌روزرسانی ساعات فعالیت روزهای پنج‌شنبه', date: '۱۴۰۵/۰۸/۲۴', type: 'فوری' },
    { id: 'eh-2', detail: 'ارسال درخواست تغییر تعرفه ماهانه به SPORTLINK', date: '۱۴۰۵/۰۸/۱۸', type: 'نیازمند تأیید' },
  ];

  const getManagedClub = () => getClubs().find((c) => c.id === user.managedClubId);

  const render = () => {
    const club = getManagedClub();
    if (!club) {
      root.innerHTML = `<div class="container section"><div class="state-box"><h2>مجموعه متصل به حساب شما یافت نشد.</h2></div></div>`;
      return;
    }

    const sportsList = getSportsList();
    const changeReqs = getChangeRequests().filter((r) => r.clubId === club.id);
    const pendingCount = changeReqs.filter((r) => r.status === 'در انتظار بررسی').length;

    const tabs = [
      { id: 'overview', label: 'داشبورد و اطلاعات مجموعه' },
      { id: 'edit_info', label: 'ویرایش اطلاعات و هویت' },
      { id: 'media', label: 'مدیریت تصاویر' },
      { id: 'sports_fac', label: 'رشته‌ها و امکانات' },
      { id: 'hours', label: 'ساعات فعالیت' },
      { id: 'changes', label: `درخواست‌های تغییر (${formatNumberFa(pendingCount)})` },
      { id: 'analytics', label: 'آمار تجمیعی مجموعه' },
    ];

    root.innerHTML = `
      <div class="container">
        <div class="workspace-shell">
          <aside class="workspace-sidebar" aria-label="منوی پنل مدیر باشگاه">
            <div style="padding:0.5rem 0.75rem 1rem;border-bottom:1px solid var(--border-subtle);margin-bottom:0.75rem;">
              <div style="font-weight:700;">${escapeHtml(club.name)}</div>
              <div style="font-size:0.8125rem;color:var(--text-muted);">محله ${escapeHtml(club.neighborhood)} · مشهد</div>
            </div>
            <nav class="workspace-nav">
              ${tabs
                .map(
                  (t) => `
                  <button type="button" class="workspace-nav-btn js-mgr-tab ${activeTab === t.id ? 'is-active' : ''}" data-tab="${t.id}">
                    <span>${escapeHtml(t.label)}</span>
                  </button>
                `
                )
                .join('')}
            </nav>
          </aside>

          <section class="workspace-content" id="mgr-tab-body"></section>
        </div>
      </div>
    `;

    root.querySelectorAll('.js-mgr-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        render();
      });
    });

    const bodyEl = document.getElementById('mgr-tab-body');
    if (!bodyEl) return;

    if (activeTab === 'overview') {
      bodyEl.innerHTML = `
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">بازدید صفحه مجموعه</div>
            <div class="kpi-value">${formatNumberFa(club.viewsCount)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">نمایش در نتایج جست‌وجو</div>
            <div class="kpi-value">${formatNumberFa(club.searchImpressions)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">کلیک روی شماره تماس</div>
            <div class="kpi-value">${formatNumberFa(club.phoneClicks)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">تغییرات در انتظار تأیید</div>
            <div class="kpi-value">${formatNumberFa(pendingCount)}</div>
          </div>
        </div>

        <div class="card">
          <h2 style="font-size:1.15rem;">خلاصه وضعیت مجموعه</h2>
          <div class="info-list">
            <div class="info-list-row">
              <span class="info-list-label">نام باشگاه</span>
              <span>${escapeHtml(club.name)}</span>
            </div>
            <div class="info-list-row">
              <span class="info-list-label">آدرس</span>
              <span>${escapeHtml(club.fullAddress)}</span>
            </div>
            <div class="info-list-row">
              <span class="info-list-label">شماره تماس</span>
              <span class="tabular-nums">${escapeHtml(club.phone)}</span>
            </div>
            <div class="info-list-row">
              <span class="info-list-label">قیمت</span>
              <span>${escapeHtml(club.priceInfo?.label || 'استعلام قیمت')}</span>
            </div>
          </div>
        </div>
      `;
    } else if (activeTab === 'edit_info') {
      bodyEl.innerHTML = `
        <div class="form-stack">
          <section class="card">
            <h2 style="font-size:1.15rem;">تغییرات ساده (انتشار فوری)</h2>
            <form id="mgr-minor-form" class="form-stack">
              <div class="form-group">
                <label class="form-label" for="mgr-short-desc">معرفی کوتاه</label>
                <input type="text" id="mgr-short-desc" class="form-control" value="${escapeHtml(club.shortDescription)}" />
              </div>
              <div class="form-group">
                <label class="form-label" for="mgr-desc">توضیحات کامل مجموعه</label>
                <textarea id="mgr-desc" class="form-textarea">${escapeHtml(club.description)}</textarea>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label" for="mgr-ig">اینستاگرام</label>
                  <input type="text" id="mgr-ig" class="form-control en-wordmark" value="${escapeHtml(club.social?.instagram || '')}" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="mgr-web">وب‌سایت</label>
                  <input type="text" id="mgr-web" class="form-control en-wordmark" value="${escapeHtml(club.website || '')}" />
                </div>
              </div>
              <div>
                <button type="submit" class="btn btn-primary">انتشار فوری تغییرات ساده</button>
              </div>
            </form>
          </section>

          <section class="card">
            <h2 style="font-size:1.15rem;">تغییرات مهم (نیازمند تأیید SPORTLINK)</h2>
            <p style="font-size:0.875rem;color:var(--text-muted);">
              تغییر نام باشگاه، آدرس، شماره تماس، قیمت و اطلاعات هویتی پس از بررسی و تأیید ادمین منتشر می‌شود.
            </p>
            <form id="mgr-critical-form" class="form-stack">
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label" for="mgr-c-field">فیلد موردنظر</label>
                  <select id="mgr-c-field" class="form-select">
                    <option value="name">نام باشگاه</option>
                    <option value="fullAddress">آدرس مجموعه</option>
                    <option value="phone">شماره تماس</option>
                    <option value="priceInfo">قیمت / تعرفه</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="mgr-c-value">مقدار پیشنهادی جدید</label>
                  <input type="text" id="mgr-c-value" class="form-control" placeholder="مقدار جدید را وارد کنید" />
                </div>
              </div>
              <div>
                <button type="submit" class="btn btn-secondary">ارسال برای تأیید SPORTLINK</button>
              </div>
            </form>
          </section>
        </div>
      `;

      document.getElementById('mgr-minor-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const sd = document.getElementById('mgr-short-desc').value.trim();
        const d = document.getElementById('mgr-desc').value.trim();
        const ig = document.getElementById('mgr-ig').value.trim();
        const web = document.getElementById('mgr-web').value.trim();

        const updated = getClubs().map((c) =>
          c.id === club.id
            ? {
                ...c,
                shortDescription: sd || c.shortDescription,
                description: d || c.description,
                website: web,
                social: { ...c.social, instagram: ig },
                updatedAtJalali: getCurrentJalaliDate(),
              }
            : c
        );
        saveClubs(updated);
        editHistory.unshift({ id: `eh-${Date.now()}`, detail: 'ویرایش توضیحات و اطلاعات ارتباطی', date: getCurrentJalaliDate(), type: 'فوری' });
        showToast({ type: 'success', message: 'تغییرات ساده بلافاصله منتشر شد.' });
      });

      document.getElementById('mgr-critical-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const field = document.getElementById('mgr-c-field').value;
        const val = document.getElementById('mgr-c-value').value.trim();
        if (!val) {
          showToast({ type: 'error', message: 'لطفاً مقدار جدید را وارد کنید.' });
          return;
        }
        const fieldLabels = {
          name: 'نام باشگاه',
          fullAddress: 'آدرس مجموعه',
          phone: 'شماره تماس',
          priceInfo: 'قیمت / تعرفه',
        };
        const oldVal = field === 'priceInfo' ? club.priceInfo?.label : club[field];
        const req = {
          id: `creq-${Date.now()}`,
          clubId: club.id,
          clubName: club.name,
          requestedBy: `${user.firstName} ${user.lastName}`,
          field,
          fieldLabel: fieldLabels[field] || field,
          oldValue: oldVal || '—',
          newValue: val,
          status: 'در انتظار بررسی',
          submittedAtJalali: getCurrentJalaliDate(),
        };
        saveChangeRequests([req, ...getChangeRequests()]);
        editHistory.unshift({ id: `eh-${Date.now()}`, detail: `درخواست تغییر ${fieldLabels[field]}`, date: getCurrentJalaliDate(), type: 'در انتظار تأیید' });
        pushNotification({
          type: 'اعلان‌های سیستمی',
          title: `درخواست تغییر ${fieldLabels[field]} ثبت شد`,
          message: 'درخواست تغییر مهم شما در صف بررسی ادمین SPORTLINK قرار گرفت.',
          link: '/pages/manager-dashboard.html',
          userId: user.id,
        });
        showToast({ type: 'info', message: 'درخواست تغییر با وضعیت «در انتظار بررسی» ثبت شد.' });
        render();
      });
    } else if (activeTab === 'media') {
      const sampleGalleryOptions = Object.entries(IMAGES);
      bodyEl.innerHTML = `
        <div class="card">
          <h2 style="font-size:1.15rem;">مدیریت تصاویر مجموعه</h2>
          <div class="grid-3" style="margin-bottom:1.5rem;">
            ${(club.images || [])
              .map(
                (img, idx) => `
                <div style="border:1px solid var(--border-subtle);border-radius:var(--radius-md);overflow:hidden;">
                  <img src="${escapeHtml(img)}" alt="تصویر ${formatNumberFa(idx + 1)}" style="aspect-ratio:4/3;width:100%;object-fit:cover;" />
                  <div style="padding:0.6rem;display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:0.8125rem;">تصویر ${formatNumberFa(idx + 1)}</span>
                    <button type="button" class="btn btn-danger btn-sm js-mgr-del-img" data-idx="${idx}" ${(club.images || []).length <= 1 ? 'disabled' : ''}>حذف</button>
                  </div>
                </div>
              `
              )
              .join('')}
          </div>
          <div style="display:flex;gap:0.75rem;align-items:end;flex-wrap:wrap;">
            <div class="form-group" style="min-width:240px;">
              <label class="form-label" for="mgr-add-img-select">افزودن تصویر از آرشیو نمونه</label>
              <select id="mgr-add-img-select" class="form-select">
                ${sampleGalleryOptions.map(([k, url]) => `<option value="${url}">${escapeHtml(k)}</option>`).join('')}
              </select>
            </div>
            <button type="button" class="btn btn-primary" id="mgr-add-img-btn">افزودن تصویر</button>
          </div>
        </div>
      `;

      document.getElementById('mgr-add-img-btn')?.addEventListener('click', () => {
        const url = document.getElementById('mgr-add-img-select').value;
        const updated = getClubs().map((c) =>
          c.id === club.id ? { ...c, images: [...(c.images || []), url] } : c
        );
        saveClubs(updated);
        showToast({ type: 'success', message: 'تصویر جدید به گالری اضافه شد.' });
        render();
      });

      bodyEl.querySelectorAll('.js-mgr-del-img').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx, 10);
          if ((club.images || []).length <= 1) return;
          const updated = getClubs().map((c) =>
            c.id === club.id ? { ...c, images: c.images.filter((_, i) => i !== idx) } : c
          );
          saveClubs(updated);
          showToast({ type: 'info', message: 'تصویر حذف شد.' });
          render();
        });
      });
    } else if (activeTab === 'sports_fac') {
      bodyEl.innerHTML = `
        <div class="form-stack">
          <section class="card">
            <h2 style="font-size:1.15rem;">مدیریت رشته‌ها و امکانات استاندارد</h2>
            <form id="mgr-sf-form" class="form-stack">
              <div>
                <h3 style="font-size:0.95rem;margin-bottom:0.75rem;">امکانات مجموعه</h3>
                <div class="check-grid">
                  ${FACILITIES.map(
                    (f) => `
                      <label class="check-item">
                        <input type="checkbox" class="js-mgr-fac" value="${escapeHtml(f.id)}" ${(club.facilities || []).includes(f.id) ? 'checked' : ''} />
                        <span>${escapeHtml(f.name)}</span>
                      </label>
                    `
                  ).join('')}
                </div>
              </div>
              <div>
                <h3 style="font-size:0.95rem;margin-bottom:0.75rem;">رشته‌های ورزشی</h3>
                <div class="check-grid">
                  ${sportsList
                    .slice(0, 14)
                    .map(
                      (sp) => `
                      <label class="check-item">
                        <input type="checkbox" class="js-mgr-sport" value="${escapeHtml(sp.id)}" ${(club.sports || []).includes(sp.id) ? 'checked' : ''} />
                        <span>${escapeHtml(sp.name)}</span>
                      </label>
                    `
                    )
                    .join('')}
                </div>
              </div>
              <div>
                <button type="submit" class="btn btn-primary">ذخیره فوری رشته‌ها و امکانات</button>
              </div>
            </form>
          </section>

          <section class="card">
            <h2 style="font-size:1.15rem;">درخواست افزودن امکانات سفارشی جدید</h2>
            <p style="font-size:0.875rem;color:var(--text-muted);">امکانات سفارشی جدید پیش از نمایش عمومی باید توسط SPORTLINK تأیید شوند.</p>
            <form id="mgr-custom-fac-form" style="display:flex;gap:0.75rem;flex-wrap:wrap;">
              <input type="text" id="mgr-custom-fac-input" class="form-control" style="max-width:340px;" placeholder="مثلاً اتاق یخ‌درمانی" />
              <button type="submit" class="btn btn-secondary">ارسال برای تأیید</button>
            </form>
          </section>
        </div>
      `;

      document.getElementById('mgr-sf-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const facs = Array.from(bodyEl.querySelectorAll('.js-mgr-fac:checked')).map((i) => i.value);
        const sps = Array.from(bodyEl.querySelectorAll('.js-mgr-sport:checked')).map((i) => i.value);
        const updated = getClubs().map((c) =>
          c.id === club.id ? { ...c, facilities: facs, sports: sps, updatedAtJalali: getCurrentJalaliDate() } : c
        );
        saveClubs(updated);
        showToast({ type: 'success', message: 'رشته‌ها و امکانات به‌روزرسانی شدند.' });
      });

      document.getElementById('mgr-custom-fac-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = document.getElementById('mgr-custom-fac-input').value.trim();
        if (!val) return;
        const req = {
          id: `creq-${Date.now()}`,
          clubId: club.id,
          clubName: club.name,
          requestedBy: `${user.firstName} ${user.lastName}`,
          field: 'customFacility',
          fieldLabel: 'امکانات سفارشی جدید',
          oldValue: '—',
          newValue: val,
          status: 'در انتظار بررسی',
          submittedAtJalali: getCurrentJalaliDate(),
        };
        saveChangeRequests([req, ...getChangeRequests()]);
        showToast({ type: 'info', message: 'امکان سفارشی برای تأیید SPORTLINK ارسال شد.' });
        render();
      });
    } else if (activeTab === 'hours') {
      const days = [['sat', 'شنبه'], ['sun', 'یک‌شنبه'], ['mon', 'دوشنبه'], ['tue', 'سه‌شنبه'], ['wed', 'چهارشنبه'], ['thu', 'پنج‌شنبه'], ['fri', 'جمعه']];
      bodyEl.innerHTML = `
        <div class="card">
          <h2 style="font-size:1.15rem;">مدیریت ساعات فعالیت</h2>
          <form id="mgr-hours-form" class="form-stack">
            ${days
              .map(([k, label]) => {
                const slot = club.hours?.[k] || { open: '08:00', close: '22:00', note: '' };
                return `
                  <div class="form-row-2" style="align-items:center;border-bottom:1px solid var(--border-subtle);padding-bottom:0.75rem;">
                    <strong>${label}</strong>
                    <div style="display:flex;gap:0.5rem;">
                      <input type="text" class="form-control js-h-open" data-day="${k}" value="${escapeHtml(slot.open)}" placeholder="07:00 یا closed" />
                      <input type="text" class="form-control js-h-close" data-day="${k}" value="${escapeHtml(slot.close)}" placeholder="23:00 یا closed" />
                    </div>
                  </div>
                `;
              })
              .join('')}
            <div>
              <button type="submit" class="btn btn-primary">ذخیره ساعات فعالیت</button>
            </div>
          </form>
        </div>
      `;

      document.getElementById('mgr-hours-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const nextHours = { ...(club.hours || {}) };
        bodyEl.querySelectorAll('.js-h-open').forEach((inp) => {
          const day = inp.dataset.day;
          const closeInp = bodyEl.querySelector(`.js-h-close[data-day="${day}"]`);
          nextHours[day] = {
            ...(nextHours[day] || {}),
            open: inp.value.trim() || '08:00',
            close: closeInp?.value.trim() || '22:00',
          };
        });
        saveClubs(getClubs().map((c) => (c.id === club.id ? { ...c, hours: nextHours, updatedAtJalali: getCurrentJalaliDate() } : c)));
        showToast({ type: 'success', message: 'ساعات فعالیت به‌روزرسانی شد.' });
      });
    } else if (activeTab === 'changes') {
      bodyEl.innerHTML = `
        <div class="form-stack">
          <div class="card">
            <h2 style="font-size:1.15rem;">وضعیت درخواست‌های تغییر</h2>
            ${
              changeReqs.length === 0
                ? '<p style="color:var(--text-muted);margin:0;">درخواستی ثبت نشده است.</p>'
                : `<div class="table-wrap"><table class="data-table table-responsive-cards">
                    <thead><tr><th>فیلد</th><th>مقدار جدید</th><th>تاریخ</th><th>وضعیت</th></tr></thead>
                    <tbody>
                      ${changeReqs
                        .map(
                          (r) => `
                          <tr>
                            <td data-label="فیلد">${escapeHtml(r.fieldLabel)}</td>
                            <td data-label="مقدار جدید">${escapeHtml(r.newValue)}</td>
                            <td data-label="تاریخ" class="tabular-nums">${escapeHtml(r.submittedAtJalali)}</td>
                            <td data-label="وضعیت"><span class="status-label ${r.status === 'تأیید شده' ? 'is-approved' : r.status === 'رد شده' ? 'is-rejected' : 'is-pending'}">${escapeHtml(r.status)}</span></td>
                          </tr>
                        `
                        )
                        .join('')}
                    </tbody>
                  </table></div>`
            }
          </div>

          <div class="card">
            <h2 style="font-size:1.15rem;">تاریخچه ویرایش‌ها</h2>
            <ul class="info-list">
              ${editHistory
                .map(
                  (h) => `
                  <li class="info-list-row">
                    <span>${escapeHtml(h.detail)}</span>
                    <span class="tabular-nums" style="color:var(--text-muted);font-size:0.8125rem;">${escapeHtml(h.type)} · ${escapeHtml(h.date)}</span>
                  </li>
                `
                )
                .join('')}
            </ul>
          </div>
        </div>
      `;
    } else if (activeTab === 'analytics') {
      const series = ANALYTICS_SERIES[analyticsPeriod] || ANALYTICS_SERIES.daily;
      const maxViews = Math.max(...series.map((s) => s.views), 1);

      bodyEl.innerHTML = `
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;margin-bottom:1.25rem;">
            <div>
              <h2 style="font-size:1.15rem;margin-bottom:0.25rem;">آمار تجمیعی بازدید و کلیک شماره تماس</h2>
              <p style="font-size:0.8125rem;color:var(--text-muted);margin:0;">فقط آمار تجمیعی نمایش داده می‌شود و هویت بازدیدکنندگان محرمانه می‌ماند.</p>
            </div>
            <div style="display:flex;gap:0.5rem;align-items:center;">
              <div class="segmented-control">
                <button type="button" class="segmented-btn js-period-btn ${analyticsPeriod === 'daily' ? 'is-active' : ''}" data-period="daily">روزانه</button>
                <button type="button" class="segmented-btn js-period-btn ${analyticsPeriod === 'weekly' ? 'is-active' : ''}" data-period="weekly">هفتگی</button>
                <button type="button" class="segmented-btn js-period-btn ${analyticsPeriod === 'monthly' ? 'is-active' : ''}" data-period="monthly">ماهانه</button>
              </div>
            </div>
          </div>

          <div class="meta-inline" style="margin-bottom:0.75rem;">
            <span style="color:var(--accent-gold);">■ بازدید صفحه</span>
            <span class="meta-sep">·</span>
            <span style="color:var(--info);">■ کلیک روی شماره تماس</span>
          </div>

          <div class="chart-bars" role="img" aria-label="نمودار آمار تجمیعی بازدید و کلیک تماس">
            ${series
              .map((pt) => {
                const vh = Math.round((pt.views / maxViews) * 165);
                const ch = Math.max(8, Math.round((pt.phoneClicks / maxViews) * 165));
                return `
                  <div class="chart-col">
                    <div class="chart-bar-pair">
                      <div class="chart-bar-views" style="height:${vh}px;" title="بازدید: ${pt.views}"></div>
                      <div class="chart-bar-clicks" style="height:${ch}px;" title="کلیک تماس: ${pt.phoneClicks}"></div>
                    </div>
                    <span class="chart-label">${escapeHtml(pt.label)}</span>
                  </div>
                `;
              })
              .join('')}
          </div>

          <div class="table-wrap" style="margin-top:1.25rem;">
            <table class="data-table">
              <thead><tr><th>بازه</th><th>بازدید صفحه</th><th>کلیک روی شماره تماس</th></tr></thead>
              <tbody>
                ${series
                  .map(
                    (pt) => `
                    <tr>
                      <td>${escapeHtml(pt.label)}</td>
                      <td class="tabular-nums">${formatNumberFa(pt.views)}</td>
                      <td class="tabular-nums">${formatNumberFa(pt.phoneClicks)}</td>
                    </tr>
                  `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      bodyEl.querySelectorAll('.js-period-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          analyticsPeriod = btn.dataset.period;
          render();
        });
      });
    }
  };

  render();
}
