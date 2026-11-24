/**
 * SPORTLINK — Club Detail Page Controller
 * Gallery slider (prev/next, index, lightbox modal, touch swipe),
 * open/closed status in Asia/Tehran, hours, Toman prices or "استعلام قیمت",
 * Mashhad address & external routing (no fake map), phone click metric, report link.
 */

import { getSportById, getFacilityById, getClubOpenStatus, formatNumberFa } from '../data.js';
import { getClubs, saveClubs } from '../storage.js';
import { getQueryParam } from '../router.js';
import { isClubFavorite, toggleClubFavorite } from '../favorites.js';
import { isInCompare, toggleCompareClub } from '../comparison.js';
import { escapeHtml, openModal, showToast } from '../components/ui.js';

const DAY_LABELS = [
  ['sat', 'شنبه'],
  ['sun', 'یک‌شنبه'],
  ['mon', 'دوشنبه'],
  ['tue', 'سه‌شنبه'],
  ['wed', 'چهارشنبه'],
  ['thu', 'پنج‌شنبه'],
  ['fri', 'جمعه'],
];

export function initClubDetailPage() {
  const clubId = getQueryParam('id', '');
  const root = document.getElementById('club-detail-root');
  if (!root) return;

  const allClubs = getClubs();
  const club = allClubs.find((c) => c.id === clubId && c.status === 'published');

  if (!club) {
    root.innerHTML = `
      <div class="container section">
        <div class="state-box">
          <h1>مجموعه ورزشی موردنظر یافت نشد</h1>
          <p>ممکن است این مجموعه هنوز منتشر نشده باشد یا شناسه آن تغییر کرده باشد.</p>
          <a href="/pages/clubs.html" class="btn btn-primary">بازگشت به دایرکتوری باشگاه‌ها</a>
        </div>
      </div>
    `;
    return;
  }

  // Increment view count (aggregated metric only)
  const updatedClubs = allClubs.map((c) =>
    c.id === club.id ? { ...c, viewsCount: (c.viewsCount || 0) + 1 } : c
  );
  saveClubs(updatedClubs);

  document.title = `${club.name} | SPORTLINK`;

  const images = club.images && club.images.length > 0 ? club.images : [];
  let currentSlide = 0;

  const status = getClubOpenStatus(club.hours);
  const isFav = isClubFavorite(club.id);
  const isCmp = isInCompare(club.id);

  const sportsHtml = (club.sports || [])
    .map((id) => {
      const sp = getSportById(id);
      return sp
        ? `<a href="/pages/sport-detail.html?id=${encodeURIComponent(sp.id)}" class="btn btn-ghost btn-sm">${escapeHtml(sp.name)}</a>`
        : '';
    })
    .join('');

  const facilitiesHtml = (club.facilities || [])
    .map((id) => {
      const fac = getFacilityById(id);
      return fac ? `<li>• ${escapeHtml(fac.name)}</li>` : '';
    })
    .join('');

  const hoursRowsHtml = DAY_LABELS.map(([key, label]) => {
    const slot = club.hours?.[key];
    const timeText = !slot || slot.open === 'closed' ? 'تعطیل' : `${slot.open} تا ${slot.close}`;
    return `
      <tr>
        <td>${escapeHtml(label)}</td>
        <td class="tabular-nums">${escapeHtml(timeText)}</td>
        <td style="color:var(--text-muted);">${escapeHtml(slot?.note || '—')}</td>
      </tr>
    `;
  }).join('');

  const mapQuery = encodeURIComponent(`مشهد ${club.neighborhood} ${club.shortAddress}`);
  const routingUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

  root.innerHTML = `
    <div class="page-intro">
      <div class="container">
        <nav class="breadcrumbs" aria-label="مسیر صفحه">
          <a href="/index.html">صفحه اصلی</a>
          <span aria-hidden="true">/</span>
          <a href="/pages/clubs.html">باشگاه‌های مشهد</a>
          <span aria-hidden="true">/</span>
          <span>${escapeHtml(club.name)}</span>
        </nav>

        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
          <div>
            <div class="meta-inline" style="margin-bottom:0.5rem;">
              <span>${escapeHtml(club.type)}</span>
              <span class="meta-sep" aria-hidden="true">·</span>
              <span>مشهد، محله ${escapeHtml(club.neighborhood)}</span>
              ${
                status.known
                  ? `<span class="meta-sep" aria-hidden="true">·</span>
                     <span class="status-label ${status.isOpen ? 'is-open' : 'is-closed'}">${escapeHtml(status.label)}</span>`
                  : ''
              }
            </div>
            <h1>${escapeHtml(club.name)}</h1>
            <p>${escapeHtml(club.shortDescription)}</p>
          </div>

          <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
            <button type="button" class="btn ${isFav ? 'btn-primary' : 'btn-secondary'}" id="detail-fav-btn" aria-pressed="${isFav}">
              ${isFav ? 'در علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
            </button>
            <button type="button" class="btn ${isCmp ? 'btn-primary' : 'btn-secondary'}" id="detail-cmp-btn" aria-pressed="${isCmp}">
              ${isCmp ? 'انتخاب‌شده برای مقایسه' : 'افزودن به مقایسه'}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="container">
      <div class="club-detail-grid">
        <div class="form-stack">
          <!-- Gallery Slider -->
          <section aria-label="گالری تصاویر مجموعه">
            <div class="gallery-slider" id="club-gallery-slider">
              ${
                images.length > 0
                  ? `<img id="gallery-main-img" src="${escapeHtml(images[0])}" alt="${escapeHtml(club.name)} - تصویر ۱" referrerpolicy="no-referrer" />`
                  : `<div class="img-fallback"><span>تصویری برای این مجموعه ثبت نشده است.</span></div>`
              }
              ${
                images.length > 0
                  ? `
                <div class="gallery-controls">
                  <button type="button" id="gallery-prev-btn" aria-label="تصویر قبلی">‹</button>
                  <button type="button" id="gallery-next-btn" aria-label="تصویر بعدی">›</button>
                </div>
                <div class="gallery-meta-bar">
                  <span class="gallery-counter" id="gallery-counter">۱ از ${formatNumberFa(images.length)}</span>
                  <button type="button" class="btn btn-secondary btn-sm" id="gallery-zoom-btn">مشاهده تصویر بزرگ</button>
                </div>
              `
                  : ''
              }
            </div>
          </section>

          <!-- Description -->
          <section class="card">
            <h2 style="font-size:1.2rem;">معرفی مجموعه</h2>
            <p style="margin-bottom:0;">${escapeHtml(club.description)}</p>
          </section>

          <!-- Sports -->
          <section class="card">
            <h2 style="font-size:1.2rem;">رشته‌های ورزشی ارائه‌شده</h2>
            <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
              ${sportsHtml || '<span style="color:var(--text-muted);">رشته‌ای ثبت نشده است.</span>'}
            </div>
          </section>

          <!-- Facilities -->
          <section class="card">
            <h2 style="font-size:1.2rem;">امکانات مجموعه</h2>
            <ul class="grid-2" style="gap:0.65rem;color:var(--gray-light);font-size:0.9375rem;">
              ${facilitiesHtml || '<li>امکاناتی ثبت نشده است.</li>'}
            </ul>
          </section>

          <!-- Hours -->
          <section class="card">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:1rem;">
              <h2 style="font-size:1.2rem;margin:0;">ساعات فعالیت</h2>
              <span style="font-size:0.8125rem;color:var(--text-muted);">آخرین به‌روزرسانی: ${escapeHtml(club.updatedAtJalali || 'نامشخص')}</span>
            </div>
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>روز</th>
                    <th>ساعت کاری</th>
                    <th>توضیح</th>
                  </tr>
                </thead>
                <tbody>${hoursRowsHtml}</tbody>
              </table>
            </div>
          </section>
        </div>

        <!-- Side Column: Status, Price, Location, Contact, Manager, Report -->
        <aside class="form-stack">
          <div class="card">
            <h2 style="font-size:1.125rem;">وضعیت و اطلاعات پایه</h2>
            <div class="info-list">
              <div class="info-list-row">
                <span class="info-list-label">وضعیت فعلی</span>
                <span class="status-label ${status.isOpen ? 'is-open' : 'is-closed'}">${escapeHtml(status.label)}</span>
              </div>
              <div class="info-list-row">
                <span class="info-list-label">ساعت امروز</span>
                <span class="tabular-nums">${escapeHtml(status.todayRange)}</span>
              </div>
              <div class="info-list-row">
                <span class="info-list-label">تعرفه و قیمت</span>
                <span>${escapeHtml(club.priceInfo?.hasPrice ? club.priceInfo.label : 'استعلام قیمت')}</span>
              </div>
              <div class="info-list-row">
                <span class="info-list-label">به‌روزرسانی</span>
                <span class="tabular-nums">${escapeHtml(club.updatedAtJalali)}</span>
              </div>
            </div>
          </div>

          <div class="card">
            <h2 style="font-size:1.125rem;">آدرس و موقعیت در مشهد</h2>
            <p style="font-size:0.9rem;margin-bottom:0.5rem;">${escapeHtml(club.fullAddress)}</p>
            ${club.locationHint ? `<p style="font-size:0.8125rem;color:var(--text-muted);">${escapeHtml(club.locationHint)}</p>` : ''}
            <div style="padding:0.85rem;background:var(--bg-primary);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);margin-bottom:1rem;font-size:0.8125rem;color:var(--text-muted);">
              نقشه تعاملی داخلی در نسخه آزمایشی آفلاین غیرفعال است. برای مشاهده مسیر واقعی از دکمه مسیریابی استفاده کنید.
            </div>
            <a href="${routingUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="width:100%;">مسیریابی روی نقشه</a>
          </div>

          <div class="card">
            <h2 style="font-size:1.125rem;">اطلاعات تماس</h2>
            <div class="info-list">
              <div class="info-list-row">
                <span class="info-list-label">تلفن مجموعه</span>
                <button type="button" class="btn btn-ghost btn-sm tabular-nums" id="club-phone-reveal-btn">${escapeHtml(club.phone)}</button>
              </div>
              ${
                club.website
                  ? `<div class="info-list-row">
                       <span class="info-list-label">وب‌سایت</span>
                       <span class="en-wordmark" style="font-size:0.85rem;">${escapeHtml(club.website)}</span>
                     </div>`
                  : ''
              }
              ${
                club.social?.instagram
                  ? `<div class="info-list-row">
                       <span class="info-list-label">اینستاگرام</span>
                       <span class="en-wordmark" style="font-size:0.85rem;">${escapeHtml(club.social.instagram)}</span>
                     </div>`
                  : ''
              }
              ${
                club.social?.telegram
                  ? `<div class="info-list-row">
                       <span class="info-list-label">تلگرام</span>
                       <span class="en-wordmark" style="font-size:0.85rem;">${escapeHtml(club.social.telegram)}</span>
                     </div>`
                  : ''
              }
              ${
                club.managerName
                  ? `<div class="info-list-row">
                       <span class="info-list-label">مدیر / مسئول</span>
                       <span>${escapeHtml(club.managerName)}</span>
                     </div>`
                  : ''
              }
            </div>
          </div>

          <div class="card">
            <h2 style="font-size:1.125rem;">گزارش مشکل اطلاعات</h2>
            <p style="font-size:0.875rem;color:var(--text-muted);">
              اگر شماره تماس نامعتبر است یا اطلاعات مجموعه تغییر کرده، به SPORTLINK اطلاع دهید.
            </p>
            <a href="/pages/report.html?clubId=${encodeURIComponent(club.id)}" class="btn btn-secondary" style="width:100%;">ثبت گزارش مشکل</a>
          </div>
        </aside>
      </div>
    </div>
  `;

  // Gallery Slider Interactions + Swipe + Lightbox
  const mainImg = document.getElementById('gallery-main-img');
  const counterEl = document.getElementById('gallery-counter');
  const sliderEl = document.getElementById('club-gallery-slider');

  const updateSlide = (nextIdx) => {
    if (images.length === 0 || !mainImg) return;
    currentSlide = (nextIdx + images.length) % images.length;
    mainImg.src = images[currentSlide];
    mainImg.alt = `${club.name} - تصویر ${formatNumberFa(currentSlide + 1)}`;
    if (counterEl) {
      counterEl.textContent = `${formatNumberFa(currentSlide + 1)} از ${formatNumberFa(images.length)}`;
    }
  };

  document.getElementById('gallery-prev-btn')?.addEventListener('click', () => updateSlide(currentSlide - 1));
  document.getElementById('gallery-next-btn')?.addEventListener('click', () => updateSlide(currentSlide + 1));

  document.getElementById('gallery-zoom-btn')?.addEventListener('click', () => {
    if (images.length === 0) return;
    openModal({
      title: `${club.name} — تصویر ${formatNumberFa(currentSlide + 1)}`,
      size: 'lg',
      bodyHtml: `<img src="${escapeHtml(images[currentSlide])}" alt="${escapeHtml(club.name)}" style="width:100%;max-height:70vh;object-fit:contain;border-radius:8px;" />`,
    });
  });

  if (sliderEl && images.length > 1) {
    let touchStartX = 0;
    sliderEl.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0]?.clientX || 0;
    }, { passive: true });
    sliderEl.addEventListener('touchend', (e) => {
      const endX = e.changedTouches[0]?.clientX || 0;
      const diff = endX - touchStartX;
      if (Math.abs(diff) > 40) {
        updateSlide(diff > 0 ? currentSlide - 1 : currentSlide + 1);
      }
    }, { passive: true });
  }

  // Phone click counter (MVP analytics: page views + phone clicks)
  document.getElementById('club-phone-reveal-btn')?.addEventListener('click', () => {
    const latest = getClubs().map((c) =>
      c.id === club.id ? { ...c, phoneClicks: (c.phoneClicks || 0) + 1 } : c
    );
    saveClubs(latest);
    showToast({ type: 'info', message: `شماره تماس آزمایشی: ${club.phone}` });
  });

  // Fav & Compare on detail
  const favBtn = document.getElementById('detail-fav-btn');
  favBtn?.addEventListener('click', () => {
    const res = toggleClubFavorite(club.id);
    favBtn.classList.toggle('btn-primary', res.added);
    favBtn.classList.toggle('btn-secondary', !res.added);
    favBtn.setAttribute('aria-pressed', String(res.added));
    favBtn.textContent = res.added ? 'در علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها';
    showToast({
      type: 'success',
      message: res.added ? 'به علاقه‌مندی‌ها اضافه شد.' : 'از علاقه‌مندی‌ها حذف شد.',
    });
  });

  const cmpBtn = document.getElementById('detail-cmp-btn');
  cmpBtn?.addEventListener('click', () => {
    const res = toggleCompareClub(club.id);
    if (res.status === 'limit_reached') {
      showToast({
        type: 'warning',
        message: res.message,
        actionLabel: 'مشاهده مقایسه',
        onAction: () => { window.location.href = '/pages/compare.html'; },
      });
      return;
    }
    const added = res.status === 'added';
    cmpBtn.classList.toggle('btn-primary', added);
    cmpBtn.classList.toggle('btn-secondary', !added);
    cmpBtn.setAttribute('aria-pressed', String(added));
    cmpBtn.textContent = added ? 'انتخاب‌شده برای مقایسه' : 'افزودن به مقایسه';
    showToast({ type: 'info', message: res.message });
  });
}
