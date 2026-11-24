/**
 * SPORTLINK — Sport Detail Page Controller
 * Shows sport overview + practical description (no articles/tutorials per MVP) + Mashhad clubs offering it with tailored filters.
 */

import { getCategoryById, MASHHAD_NEIGHBORHOODS, formatNumberFa } from '../data.js';
import { getSportsList, getPublishedClubs } from '../storage.js';
import { filterClubs, PRICE_RANGES } from '../filters.js';
import { isSportFavorite, toggleSportFavorite } from '../favorites.js';
import { createClubCardHtml, bindClubCardActions } from '../components/club-card.js';
import { getQueryParam } from '../router.js';
import { escapeHtml, showToast } from '../components/ui.js';

export function initSportDetailPage() {
  const sportId = getQueryParam('id', '');
  const root = document.getElementById('sport-detail-root');
  if (!root) return;

  const sports = getSportsList();
  const sport = sports.find((s) => s.id === sportId);

  if (!sport) {
    root.innerHTML = `
      <div class="container section">
        <div class="state-box">
          <h1>رشته ورزشی یافت نشد</h1>
          <p>شناسه رشته ورزشی معتبر نیست.</p>
          <a href="/pages/sports.html" class="btn btn-primary">بازگشت به رشته‌های ورزشی</a>
        </div>
      </div>
    `;
    return;
  }

  const category = getCategoryById(sport.categoryId);
  const allClubs = getPublishedClubs();
  const isFav = isSportFavorite(sport.id);
  document.title = `${sport.name} | SPORTLINK`;

  let filterNeighborhood = '';
  let filterPrice = 'all';

  root.innerHTML = `
    <div class="page-intro">
      <div class="container">
        <nav class="breadcrumbs" aria-label="مسیر صفحه">
          <a href="/index.html">صفحه اصلی</a>
          <span aria-hidden="true">/</span>
          <a href="/pages/sports.html">رشته‌های ورزشی</a>
          <span aria-hidden="true">/</span>
          <span>${escapeHtml(sport.name)}</span>
        </nav>

        <div style="display:grid;grid-template-columns:1.2fr 0.8fr;gap:2rem;align-items:center;" class="sport-hero-split">
          <div>
            <div class="meta-inline" style="margin-bottom:0.5rem;">
              <span>${escapeHtml(category ? category.name : '')}</span>
              <span class="meta-sep" aria-hidden="true">·</span>
              <span>مشهد</span>
            </div>
            <h1>${escapeHtml(sport.name)}</h1>
            <p style="color:var(--gray-light);margin-bottom:0.75rem;">${escapeHtml(sport.shortSummary)}</p>
            <p style="margin-bottom:1.25rem;">${escapeHtml(sport.description)}</p>
            <button type="button" class="btn ${isFav ? 'btn-primary' : 'btn-secondary'}" id="sport-detail-fav-btn" aria-pressed="${isFav}">
              ${isFav ? 'در علاقه‌مندی‌ها' : 'افزودن رشته به علاقه‌مندی‌ها'}
            </button>
          </div>
          <div style="aspect-ratio:16/10;border-radius:var(--radius-lg);overflow:hidden;border:1px solid var(--border-subtle);">
            <img src="${escapeHtml(sport.image)}" alt="${escapeHtml(sport.name)}" style="width:100%;height:100%;object-fit:cover;" referrerpolicy="no-referrer" />
          </div>
        </div>
      </div>
    </div>

    <div class="container section">
      <div class="section-header">
        <div>
          <h2 class="section-title">باشگاه‌های ارائه‌دهنده ${escapeHtml(sport.name)} در مشهد</h2>
          <p class="section-subtitle" id="sport-clubs-count"></p>
        </div>

        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
          <label class="sr-only" for="sport-filter-neighborhood">فیلتر محله</label>
          <select id="sport-filter-neighborhood" class="form-select" style="width:auto;min-width:160px;">
            <option value="">همه محله‌های مشهد</option>
            ${MASHHAD_NEIGHBORHOODS.map((h) => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join('')}
          </select>

          <label class="sr-only" for="sport-filter-price">فیلتر قیمت</label>
          <select id="sport-filter-price" class="form-select" style="width:auto;min-width:170px;">
            ${PRICE_RANGES.map((p) => `<option value="${p.id}">${escapeHtml(p.label)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div id="sport-clubs-grid"></div>
    </div>
  `;

  const renderMatchingClubs = () => {
    const matched = filterClubs(
      allClubs,
      { sport: sport.id, neighborhood: filterNeighborhood, priceRange: filterPrice },
      sports
    );
    const countEl = document.getElementById('sport-clubs-count');
    const gridEl = document.getElementById('sport-clubs-grid');
    if (countEl) countEl.textContent = `${formatNumberFa(matched.length)} مجموعه در مشهد یافت شد`;
    if (!gridEl) return;

    if (matched.length === 0) {
      gridEl.className = '';
      gridEl.innerHTML = `
        <div class="state-box">
          <h3>نتیجه‌ای یافت نشد.</h3>
          <p>در حال حاضر باشگاهی با این فیلتر برای رشته ${escapeHtml(sport.name)} پیدا نشد.</p>
        </div>
      `;
      return;
    }

    gridEl.className = 'grid-3';
    gridEl.innerHTML = matched.map(createClubCardHtml).join('');
    bindClubCardActions(gridEl);
  };

  document.getElementById('sport-filter-neighborhood')?.addEventListener('change', (e) => {
    filterNeighborhood = e.target.value;
    renderMatchingClubs();
  });

  document.getElementById('sport-filter-price')?.addEventListener('change', (e) => {
    filterPrice = e.target.value;
    renderMatchingClubs();
  });

  const favBtn = document.getElementById('sport-detail-fav-btn');
  favBtn?.addEventListener('click', () => {
    const res = toggleSportFavorite(sport.id);
    favBtn.classList.toggle('btn-primary', res.added);
    favBtn.classList.toggle('btn-secondary', !res.added);
    favBtn.setAttribute('aria-pressed', String(res.added));
    favBtn.textContent = res.added ? 'در علاقه‌مندی‌ها' : 'افزودن رشته به علاقه‌مندی‌ها';
    showToast({
      type: 'success',
      message: res.added ? 'به علاقه‌مندی‌ها اضافه شد.' : 'از علاقه‌مندی‌ها حذف شد.',
    });
  });

  renderMatchingClubs();
}
