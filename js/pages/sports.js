/**
 * SPORTLINK — Sports Directory Page Controller (7 Categories, 35 Sports)
 */

import { CATEGORIES, formatNumberFa } from '../data.js';
import { getSportsList, getPublishedClubs } from '../storage.js';
import { isSportFavorite, toggleSportFavorite } from '../favorites.js';
import { getQueryParam, updateQueryParams } from '../router.js';
import { escapeHtml, showToast } from '../components/ui.js';

export function initSportsPage() {
  const sports = getSportsList();
  const clubs = getPublishedClubs();

  let selectedCategory = getQueryParam('category', 'all');
  let searchQuery = getQueryParam('q', '');

  const tabsEl = document.getElementById('sports-category-tabs');
  const searchInput = document.getElementById('sports-search-input');
  const gridContainer = document.getElementById('sports-directory-content');

  if (searchInput) searchInput.value = searchQuery;

  const renderTabs = () => {
    if (!tabsEl) return;
    const allTab = `<button type="button" class="segmented-btn ${selectedCategory === 'all' ? 'is-active' : ''}" data-cat="all">همه دسته‌ها (${formatNumberFa(sports.length)})</button>`;
    const catTabs = CATEGORIES.map(
      (cat) =>
        `<button type="button" class="segmented-btn ${selectedCategory === cat.id ? 'is-active' : ''}" data-cat="${cat.id}">${escapeHtml(cat.name)}</button>`
    ).join('');
    tabsEl.innerHTML = allTab + catTabs;

    tabsEl.querySelectorAll('.segmented-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedCategory = btn.dataset.cat || 'all';
        updateQueryParams({ category: selectedCategory === 'all' ? '' : selectedCategory, q: searchQuery });
        renderTabs();
        renderCategoriesAndSports();
      });
    });
  };

  const renderCategoriesAndSports = () => {
    if (!gridContainer) return;
    const q = searchQuery.trim().toLowerCase();
    const targetCats = selectedCategory === 'all' ? CATEGORIES : CATEGORIES.filter((c) => c.id === selectedCategory);

    let totalShown = 0;
    const htmlBlocks = targetCats
      .map((cat) => {
        const catSports = sports.filter((s) => {
          if (s.categoryId !== cat.id) return false;
          if (!q) return true;
          return s.name.toLowerCase().includes(q) || s.shortSummary.toLowerCase().includes(q);
        });
        if (catSports.length === 0) return '';
        totalShown += catSports.length;

        return `
          <section class="section-tight" style="border-bottom:1px solid var(--border-subtle);">
            <div style="margin-bottom:1.25rem;">
              <h2 style="font-size:1.35rem;margin-bottom:0.35rem;">${escapeHtml(cat.name)}</h2>
              <p style="color:var(--text-muted);margin:0;">${escapeHtml(cat.description)}</p>
            </div>
            <div class="grid-3">
              ${catSports
                .map((sp) => {
                  const clubCount = clubs.filter((c) => (c.sports || []).includes(sp.id)).length;
                  const isFav = isSportFavorite(sp.id);
                  return `
                    <article class="club-card">
                      <div class="club-card-media">
                        <img src="${escapeHtml(sp.image)}" alt="${escapeHtml(sp.name)}" loading="lazy" referrerpolicy="no-referrer" />
                        <div class="club-card-overlay-actions">
                          <button
                            type="button"
                            class="btn-icon js-fav-sport-btn ${isFav ? 'is-active' : ''}"
                            data-sport-id="${escapeHtml(sp.id)}"
                            aria-label="${isFav ? 'حذف رشته از علاقه‌مندی‌ها: ' : 'افزودن رشته به علاقه‌مندی‌ها: '}${escapeHtml(sp.name)}"
                            aria-pressed="${isFav}"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" aria-hidden="true">
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div class="club-card-body">
                        <div class="meta-inline">
                          <span>${escapeHtml(cat.name)}</span>
                          <span class="meta-sep" aria-hidden="true">·</span>
                          <span class="tabular-nums">${formatNumberFa(clubCount)} مجموعه در مشهد</span>
                        </div>
                        <h3 class="club-card-title">
                          <a href="/pages/sport-detail.html?id=${encodeURIComponent(sp.id)}">${escapeHtml(sp.name)}</a>
                        </h3>
                        <p class="club-card-address">${escapeHtml(sp.shortSummary)}</p>
                        <div class="club-card-footer">
                          <a href="/pages/clubs.html?sport=${encodeURIComponent(sp.id)}" style="font-size:0.8125rem;color:var(--accent-gold);">مشاهده باشگاه‌ها</a>
                          <a href="/pages/sport-detail.html?id=${encodeURIComponent(sp.id)}" class="btn btn-secondary btn-sm">جزئیات رشته</a>
                        </div>
                      </div>
                    </article>
                  `;
                })
                .join('')}
            </div>
          </section>
        `;
      })
      .join('');

    if (totalShown === 0) {
      gridContainer.innerHTML = `
        <div class="state-box" style="margin-block:2rem;">
          <h3>نتیجه‌ای یافت نشد.</h3>
          <p>رشته ورزشی مطابق با عبارت جست‌وجوشده پیدا نشد.</p>
          <button type="button" class="btn btn-primary" id="sports-reset-btn">نمایش همه ۳۵ رشته</button>
        </div>
      `;
      document.getElementById('sports-reset-btn')?.addEventListener('click', () => {
        selectedCategory = 'all';
        searchQuery = '';
        if (searchInput) searchInput.value = '';
        updateQueryParams({ category: '', q: '' });
        renderTabs();
        renderCategoriesAndSports();
      });
      return;
    }

    gridContainer.innerHTML = htmlBlocks;

    gridContainer.querySelectorAll('.js-fav-sport-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = toggleSportFavorite(btn.dataset.sportId);
        btn.classList.toggle('is-active', res.added);
        btn.setAttribute('aria-pressed', String(res.added));
        const svg = btn.querySelector('svg');
        if (svg) svg.setAttribute('fill', res.added ? 'currentColor' : 'none');
        showToast({
          type: 'success',
          message: res.added ? 'رشته ورزشی به علاقه‌مندی‌ها اضافه شد.' : 'رشته ورزشی از علاقه‌مندی‌ها حذف شد.',
        });
      });
    });
  };

  searchInput?.addEventListener('input', () => {
    searchQuery = searchInput.value;
    updateQueryParams({ category: selectedCategory === 'all' ? '' : selectedCategory, q: searchQuery });
    renderCategoriesAndSports();
  });

  renderTabs();
  renderCategoriesAndSports();
}
