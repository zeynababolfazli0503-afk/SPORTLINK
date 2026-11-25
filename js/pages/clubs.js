/**
 * SPORTLINK — Clubs Directory Page Controller (Mashhad)
 * Desktop: sidebar filters apply live, 12 results/page, numbered pagination.
 * Mobile: Bottom Sheet filters with "اعمال فیلترها", 6 results/batch + "نمایش بیشتر".
 */

import { MASHHAD_NEIGHBORHOODS, CLUB_TYPES, FACILITIES, formatNumberFa } from '../data.js';
import { getPublishedClubs, getSportsList, saveClubs, getClubs } from '../storage.js';
import {
  filterClubs,
  sortClubs,
  paginateItems,
  SORT_OPTIONS,
  PRICE_RANGES,
  DESKTOP_PAGE_SIZE,
  MOBILE_PAGE_SIZE,
} from '../filters.js';
import { getQueryParam, updateQueryParams } from '../router.js';
import { isNewGenuineSearch, recordSearchImpressions } from '../search.js';
import { createClubCardHtml, bindClubCardActions } from '../components/club-card.js';
import { bindSearchBox } from '../components/search-box.js';
import { getCompareIds, clearCompare } from '../comparison.js';
import { escapeHtml } from '../components/ui.js';

export function initClubsPage() {
  const allPublished = getPublishedClubs();
  const sports = getSportsList();

  const state = {
    query: getQueryParam('q', ''),
    neighborhood: getQueryParam('neighborhood', ''),
    sport: getQueryParam('sport', ''),
    type: getQueryParam('type', ''),
    priceRange: getQueryParam('price', 'all'),
    facilities: getQueryParam('fac', '') ? getQueryParam('fac', '').split(',').filter(Boolean) : [],
    sortBy: getQueryParam('sort', 'relevant'),
    page: Math.max(1, parseInt(getQueryParam('page', '1'), 10) || 1),
    mobileLoadedCount: MOBILE_PAGE_SIZE,
  };

  const isMobileViewport = () => window.matchMedia('(max-width: 768px)').matches;

  const searchInput = document.getElementById('clubs-search-input');
  const searchDropdown = document.getElementById('clubs-search-dropdown');
  const searchForm = document.getElementById('clubs-search-form');
  const sortSelect = document.getElementById('clubs-sort-select');
  const resultsGrid = document.getElementById('clubs-results-grid');
  const resultsCountEl = document.getElementById('clubs-results-count');
  const activeFiltersEl = document.getElementById('active-filters-bar');
  const paginationEl = document.getElementById('clubs-pagination');
  const mobileMoreWrap = document.getElementById('clubs-mobile-more-wrap');
  const mobileMoreBtn = document.getElementById('clubs-mobile-more-btn');

  if (searchInput) searchInput.value = state.query;

  // Populate Sort options
  if (sortSelect) {
    sortSelect.innerHTML = SORT_OPTIONS.map(
      (o) => `<option value="${o.id}" ${state.sortBy === o.id ? 'selected' : ''}>${escapeHtml(o.label)}</option>`
    ).join('');
    sortSelect.addEventListener('change', () => {
      state.sortBy = sortSelect.value;
      state.page = 1;
      syncUrlAndRender();
    });
  }

  // Render Filter Controls Helper (reused in Desktop Sidebar & Mobile Bottom Sheet)
  const buildFilterFormHtml = (prefix, draftState) => `
    <div class="form-group">
      <label class="form-label" for="${prefix}-neighborhood">محله (مشهد)</label>
      <select id="${prefix}-neighborhood" class="form-select js-f-neighborhood">
        <option value="">همه محله‌ها</option>
        ${MASHHAD_NEIGHBORHOODS.map((h) => `<option value="${escapeHtml(h)}" ${draftState.neighborhood === h ? 'selected' : ''}>${escapeHtml(h)}</option>`).join('')}
      </select>
    </div>

    <div class="form-group">
      <label class="form-label" for="${prefix}-sport">رشته ورزشی</label>
      <select id="${prefix}-sport" class="form-select js-f-sport">
        <option value="">همه رشته‌ها</option>
        ${sports.map((s) => `<option value="${escapeHtml(s.id)}" ${draftState.sport === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
      </select>
    </div>

    <div class="form-group">
      <label class="form-label" for="${prefix}-type">نوع مجموعه</label>
      <select id="${prefix}-type" class="form-select js-f-type">
        <option value="">همه انواع</option>
        ${CLUB_TYPES.map((t) => `<option value="${escapeHtml(t)}" ${draftState.type === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
      </select>
    </div>

    <div class="form-group">
      <label class="form-label" for="${prefix}-price">محدوده قیمت</label>
      <select id="${prefix}-price" class="form-select js-f-price">
        ${PRICE_RANGES.map((p) => `<option value="${p.id}" ${draftState.priceRange === p.id ? 'selected' : ''}>${escapeHtml(p.label)}</option>`).join('')}
      </select>
    </div>

    <div class="form-group">
      <span class="form-label">امکانات مجموعه</span>
      <div style="display:flex;flex-direction:column;gap:0.5rem;">
        ${FACILITIES.map(
          (fac) => `
            <label class="check-item">
              <input type="checkbox" class="js-f-fac" value="${escapeHtml(fac.id)}" ${draftState.facilities.includes(fac.id) ? 'checked' : ''} />
              <span>${escapeHtml(fac.name)}</span>
            </label>
          `
        ).join('')}
      </div>
    </div>
  `;

  // Desktop Sidebar Filters
  const desktopFiltersEl = document.getElementById('desktop-filter-fields');
  const renderDesktopFilters = () => {
    if (!desktopFiltersEl) return;
    desktopFiltersEl.innerHTML = buildFilterFormHtml('desk', state);

    desktopFiltersEl.querySelector('.js-f-neighborhood')?.addEventListener('change', (e) => {
      state.neighborhood = e.target.value;
      state.page = 1;
      syncUrlAndRender();
    });
    desktopFiltersEl.querySelector('.js-f-sport')?.addEventListener('change', (e) => {
      state.sport = e.target.value;
      state.page = 1;
      syncUrlAndRender();
    });
    desktopFiltersEl.querySelector('.js-f-type')?.addEventListener('change', (e) => {
      state.type = e.target.value;
      state.page = 1;
      syncUrlAndRender();
    });
    desktopFiltersEl.querySelector('.js-f-price')?.addEventListener('change', (e) => {
      state.priceRange = e.target.value;
      state.page = 1;
      syncUrlAndRender();
    });
    desktopFiltersEl.querySelectorAll('.js-f-fac').forEach((cb) => {
      cb.addEventListener('change', () => {
        state.facilities = Array.from(desktopFiltersEl.querySelectorAll('.js-f-fac:checked')).map((el) => el.value);
        state.page = 1;
        syncUrlAndRender();
      });
    });
  };

  document.getElementById('desk-reset-filters')?.addEventListener('click', () => {
    resetAllFilters();
  });

  // Mobile Bottom Sheet Filters
  const sheetBackdrop = document.getElementById('filter-sheet-backdrop');
  const sheetEl = document.getElementById('filter-bottom-sheet');
  const sheetBody = document.getElementById('filter-sheet-body');
  const filterOpenButton = document.getElementById('mobile-filter-open-btn');

  const openBottomSheet = () => {
    if (!sheetEl || !sheetBackdrop || !sheetBody) return;
    sheetBody.innerHTML = buildFilterFormHtml('mob', state);
    sheetBackdrop.hidden = false;
    sheetEl.hidden = false;
    filterOpenButton?.setAttribute('aria-expanded', 'true');
    document.getElementById('mobile-filter-close-btn')?.focus();
  };

  const closeBottomSheet = () => {
    if (!sheetEl || !sheetBackdrop) return;
    sheetEl.hidden = true;
    sheetBackdrop.hidden = true;
    filterOpenButton?.setAttribute('aria-expanded', 'false');
    filterOpenButton?.focus();
  };

  filterOpenButton?.addEventListener('click', openBottomSheet);
  document.getElementById('mobile-filter-close-btn')?.addEventListener('click', closeBottomSheet);
  sheetBackdrop?.addEventListener('click', closeBottomSheet);
  const handleBottomSheetKeydown = (event) => {
    if (!sheetEl || sheetEl.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeBottomSheet();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = Array.from(sheetEl.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !sheetEl.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !sheetEl.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', handleBottomSheetKeydown, true);

  document.getElementById('mobile-filter-apply-btn')?.addEventListener('click', () => {
    if (!sheetBody) return;
    state.neighborhood = sheetBody.querySelector('.js-f-neighborhood')?.value || '';
    state.sport = sheetBody.querySelector('.js-f-sport')?.value || '';
    state.type = sheetBody.querySelector('.js-f-type')?.value || '';
    state.priceRange = sheetBody.querySelector('.js-f-price')?.value || 'all';
    state.facilities = Array.from(sheetBody.querySelectorAll('.js-f-fac:checked')).map((el) => el.value);
    state.page = 1;
    state.mobileLoadedCount = MOBILE_PAGE_SIZE;
    closeBottomSheet();
    renderDesktopFilters();
    syncUrlAndRender();
  });

  document.getElementById('mobile-filter-reset-btn')?.addEventListener('click', () => {
    closeBottomSheet();
    resetAllFilters();
  });

  function resetAllFilters() {
    state.query = '';
    state.neighborhood = '';
    state.sport = '';
    state.type = '';
    state.priceRange = 'all';
    state.facilities = [];
    state.page = 1;
    state.mobileLoadedCount = MOBILE_PAGE_SIZE;
    if (searchInput) searchInput.value = '';
    renderDesktopFilters();
    syncUrlAndRender();
  }

  // Search Box (Stage 1 + Stage 2 + clear value on leave)
  // Tracks the last query that was actually counted, so re-submits don't inflate stats.
  let lastCountedQuery = '';
  bindSearchBox({
    inputEl: searchInput,
    dropdownEl: searchDropdown,
    formEl: searchForm,
    getMode: () => 'clubs',
    clearOnPageLeave: true,
    onSubmitSearch: (term) => {
      state.query = term;
      state.page = 1;
      state.mobileLoadedCount = MOBILE_PAGE_SIZE;

      // One impression per explicit, non-empty, newly submitted query only.
      if (isNewGenuineSearch(term, lastCountedQuery)) {
        lastCountedQuery = String(term || '').trim();
        const matched = sortClubs(filterClubs(allPublished, state, sports), state.sortBy, term);
        saveClubs(recordSearchImpressions(getClubs(), matched.map((c) => c.id), term));
      }

      syncUrlAndRender();
    },
  });

  // Update floating compare bar
  function renderCompareFloatingBar() {
    const bar = document.getElementById('compare-floating-bar');
    const countSpan = document.getElementById('compare-floating-count');
    if (!bar || !countSpan) return;
    const ids = getCompareIds();
    bar.hidden = ids.length === 0;
    countSpan.textContent = `${formatNumberFa(ids.length)} از ۲ باشگاه برای مقایسه انتخاب شده`;
  }

  document.getElementById('compare-floating-clear')?.addEventListener('click', () => {
    clearCompare();
    renderResults();
  });

  function renderActiveFilters() {
    if (!activeFiltersEl) return;
    const chips = [];
    if (state.query) chips.push({ key: 'query', label: `جست‌وجو: ${state.query}` });
    if (state.neighborhood) chips.push({ key: 'neighborhood', label: `محله: ${state.neighborhood}` });
    if (state.sport) {
      const sp = sports.find((s) => s.id === state.sport);
      chips.push({ key: 'sport', label: `رشته: ${sp ? sp.name : state.sport}` });
    }
    if (state.type) chips.push({ key: 'type', label: `نوع: ${state.type}` });
    if (state.priceRange && state.priceRange !== 'all') {
      const pr = PRICE_RANGES.find((p) => p.id === state.priceRange);
      chips.push({ key: 'priceRange', label: `قیمت: ${pr ? pr.label : state.priceRange}` });
    }
    state.facilities.forEach((fId) => {
      const fac = FACILITIES.find((f) => f.id === fId);
      chips.push({ key: `fac:${fId}`, label: `امکانات: ${fac ? fac.name : fId}` });
    });

    if (chips.length === 0) {
      activeFiltersEl.hidden = true;
      activeFiltersEl.innerHTML = '';
      return;
    }

    activeFiltersEl.hidden = false;
    activeFiltersEl.innerHTML = `
      ${chips
        .map(
          (c) => `
          <button type="button" class="filter-remove-btn js-remove-filter" data-key="${escapeHtml(c.key)}" aria-label="حذف فیلتر ${escapeHtml(c.label)}">
            <span>${escapeHtml(c.label)}</span>
            <span aria-hidden="true">✕</span>
          </button>
        `
        )
        .join('')}
      <button type="button" class="btn btn-ghost btn-sm" id="clear-all-active-filters">پاک‌کردن همه</button>
    `;

    activeFiltersEl.querySelectorAll('.js-remove-filter').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        if (key === 'query') {
          state.query = '';
          if (searchInput) searchInput.value = '';
        } else if (key === 'neighborhood') state.neighborhood = '';
        else if (key === 'sport') state.sport = '';
        else if (key === 'type') state.type = '';
        else if (key === 'priceRange') state.priceRange = 'all';
        else if (key?.startsWith('fac:')) {
          const fid = key.replace('fac:', '');
          state.facilities = state.facilities.filter((x) => x !== fid);
        }
        state.page = 1;
        renderDesktopFilters();
        syncUrlAndRender();
      });
    });

    document.getElementById('clear-all-active-filters')?.addEventListener('click', resetAllFilters);
  }

  function syncUrlAndRender() {
    updateQueryParams({
      q: state.query,
      neighborhood: state.neighborhood,
      sport: state.sport,
      type: state.type,
      price: state.priceRange === 'all' ? '' : state.priceRange,
      fac: state.facilities,
      sort: state.sortBy === 'relevant' ? '' : state.sortBy,
      page: state.page > 1 ? state.page : '',
    });
    renderResults();
  }

  function renderResults() {
    const filtered = filterClubs(allPublished, state, sports);
    const sorted = sortClubs(filtered, state.sortBy, state.query);

    if (resultsCountEl) {
      resultsCountEl.textContent = `${formatNumberFa(sorted.length)} مجموعه ورزشی یافت شد`;
    }

    renderActiveFilters();
    renderCompareFloatingBar();

    if (!resultsGrid) return;

    if (sorted.length === 0) {
      resultsGrid.className = '';
      resultsGrid.innerHTML = `
        <div class="state-box">
          <h3>نتیجه‌ای یافت نشد.</h3>
          <p>با فیلترهای فعلی باشگاهی در مشهد مطابقت نداشت. می‌توانید برخی فیلترها را تغییر دهید یا همه را پاک کنید.</p>
          <button type="button" class="btn btn-primary" id="empty-reset-btn">پاک‌کردن همه فیلترها</button>
        </div>
      `;
      document.getElementById('empty-reset-btn')?.addEventListener('click', resetAllFilters);
      if (paginationEl) paginationEl.innerHTML = '';
      if (mobileMoreWrap) mobileMoreWrap.hidden = true;
      return;
    }

    // NOTE: search impressions are NOT recorded here. renderResults() also runs
    // on sort/filter/pagination/resize/"show more" and would inflate analytics.
    // They are recorded once in the explicit search submit handler below.

    resultsGrid.className = 'grid-3';

    if (isMobileViewport()) {
      const visible = sorted.slice(0, state.mobileLoadedCount);
      resultsGrid.innerHTML = visible.map(createClubCardHtml).join('');
      if (paginationEl) paginationEl.innerHTML = '';
      if (mobileMoreWrap && mobileMoreBtn) {
        const hasMore = visible.length < sorted.length;
        mobileMoreWrap.hidden = !hasMore;
        mobileMoreBtn.textContent = `نمایش بیشتر (${formatNumberFa(sorted.length - visible.length)} باقی‌مانده)`;
      }
    } else {
      if (mobileMoreWrap) mobileMoreWrap.hidden = true;
      const paged = paginateItems(sorted, state.page, DESKTOP_PAGE_SIZE);
      resultsGrid.innerHTML = paged.items.map(createClubCardHtml).join('');
      renderDesktopPagination(paged);
    }

    bindClubCardActions(resultsGrid, () => {
      renderCompareFloatingBar();
    });
  }

  function renderDesktopPagination(paged) {
    if (!paginationEl) return;
    if (paged.totalPages <= 1) {
      paginationEl.innerHTML = '';
      return;
    }

    const buttons = [];
    buttons.push(`<button type="button" class="page-btn" data-page="${paged.page - 1}" ${paged.page <= 1 ? 'disabled' : ''}>قبلی</button>`);
    for (let i = 1; i <= paged.totalPages; i += 1) {
      buttons.push(`<button type="button" class="page-btn ${i === paged.page ? 'is-active' : ''}" data-page="${i}" aria-current="${i === paged.page ? 'page' : 'false'}">${formatNumberFa(i)}</button>`);
    }
    buttons.push(`<button type="button" class="page-btn" data-page="${paged.page + 1}" ${paged.page >= paged.totalPages ? 'disabled' : ''}>بعدی</button>`);

    paginationEl.innerHTML = buttons.join('');
    paginationEl.querySelectorAll('.page-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextPage = parseInt(btn.dataset.page, 10);
        if (!isNaN(nextPage) && nextPage >= 1 && nextPage <= paged.totalPages) {
          state.page = nextPage;
          syncUrlAndRender();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
  }

  mobileMoreBtn?.addEventListener('click', () => {
    state.mobileLoadedCount += MOBILE_PAGE_SIZE;
    renderResults();
  });

  window.addEventListener('resize', () => {
    renderResults();
  });

  renderDesktopFilters();
  renderResults();
}
