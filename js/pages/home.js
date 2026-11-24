/**
 * SPORTLINK — Home Page Controller
 */

import { CATEGORIES, MASHHAD_NEIGHBORHOODS, formatNumberFa } from '../data.js';
import { getPublishedClubs, getSportsList } from '../storage.js';
import { createClubCardHtml, bindClubCardActions } from '../components/club-card.js';
import { bindSearchBox } from '../components/search-box.js';
import { escapeHtml } from '../components/ui.js';

export function initHomePage() {
  const clubs = getPublishedClubs();
  const sports = getSportsList();

  // Search mode segmented toggle (باشگاه‌ها | رشته‌های ورزشی)
  let currentMode = 'clubs';
  const modeBtns = document.querySelectorAll('.js-hero-mode-btn');
  const searchInput = document.getElementById('home-search-input');
  const searchForm = document.getElementById('home-search-form');
  const searchDropdown = document.getElementById('home-search-dropdown');

  modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      currentMode = btn.dataset.mode === 'sports' ? 'sports' : 'clubs';
      modeBtns.forEach((b) => {
        const active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      if (searchInput) {
        searchInput.placeholder =
          currentMode === 'sports'
            ? 'نام رشته ورزشی (مثلاً شنا، پیلاتس، کراس‌فیت)...'
            : 'نام باشگاه، محله سجاد، وکیل‌آباد یا رشته...';
      }
    });
  });

  bindSearchBox({
    inputEl: searchInput,
    dropdownEl: searchDropdown,
    formEl: searchForm,
    getMode: () => currentMode,
    onSubmitSearch: (term, mode) => {
      if (mode === 'sports') {
        window.location.href = term
          ? `/pages/sports.html?q=${encodeURIComponent(term)}`
          : '/pages/sports.html';
      } else {
        window.location.href = term
          ? `/pages/clubs.html?q=${encodeURIComponent(term)}`
          : '/pages/clubs.html';
      }
    },
  });

  // Render Featured Clubs (6 clubs)
  const featuredContainer = document.getElementById('home-featured-clubs');
  if (featuredContainer) {
    const featured = clubs.filter((c) => c.isFeatured).slice(0, 6);
    featuredContainer.innerHTML = featured.map(createClubCardHtml).join('');
    bindClubCardActions(featuredContainer);
  }

  // Render 7 Sports Categories
  const catContainer = document.getElementById('home-categories-grid');
  if (catContainer) {
    catContainer.innerHTML = CATEGORIES.map((cat) => {
      const count = sports.filter((s) => s.categoryId === cat.id).length;
      return `
        <a href="/pages/sports.html?category=${encodeURIComponent(cat.id)}" class="category-card">
          <div class="category-card-media">
            <img src="${escapeHtml(cat.image)}" alt="${escapeHtml(cat.name)}" loading="lazy" referrerpolicy="no-referrer" />
          </div>
          <div class="category-card-body">
            <div class="meta-inline">
              <span class="tabular-nums">${formatNumberFa(count)} رشته</span>
            </div>
            <h3>${escapeHtml(cat.name)}</h3>
            <p>${escapeHtml(cat.description)}</p>
          </div>
        </a>
      `;
    }).join('');
  }

  // Quick Neighborhood Links for Mashhad
  const hoodContainer = document.getElementById('home-neighborhoods-strip');
  if (hoodContainer) {
    hoodContainer.innerHTML = MASHHAD_NEIGHBORHOODS.slice(0, 5)
      .map(
        (hood) =>
          `<a href="/pages/clubs.html?neighborhood=${encodeURIComponent(hood)}" class="btn btn-ghost btn-sm">محله ${escapeHtml(hood)}</a>`
      )
      .join('');
  }

  // Dynamic Counts in Intro strip
  const clubsCountEl = document.getElementById('stat-clubs-count');
  const sportsCountEl = document.getElementById('stat-sports-count');
  if (clubsCountEl) clubsCountEl.textContent = formatNumberFa(clubs.length);
  if (sportsCountEl) sportsCountEl.textContent = formatNumberFa(sports.length);
}
