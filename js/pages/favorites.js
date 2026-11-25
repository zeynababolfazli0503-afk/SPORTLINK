/**
 * SPORTLINK — Favorites Page Controller
 * Supports favorite Mashhad clubs & favorite sports for both guests (LocalStorage) and logged-in users.
 */

import { getCurrentUser } from '../auth.js';
import { getFavoriteClubEntities, getFavoriteSportEntities, toggleSportFavorite } from '../favorites.js';
import { getCategoryById } from '../data.js';
import { createClubCardHtml, bindClubCardActions } from '../components/club-card.js';
import { escapeHtml, showToast } from '../components/ui.js';

export function initFavoritesPage() {
  const user = getCurrentUser();
  const noticeEl = document.getElementById('favorites-storage-notice');
  const clubsContainer = document.getElementById('fav-clubs-container');
  const sportsContainer = document.getElementById('fav-sports-container');

  if (noticeEl) {
    noticeEl.textContent = user
      ? `علاقه‌مندی‌های شما به حساب «${user.firstName} ${user.lastName}» متصل است (ذخیره‌سازی شبیه‌سازی‌شده).`
      : 'شما به‌عنوان مهمان در حال مشاهده هستید؛ علاقه‌مندی‌ها به‌صورت موقت در مرورگر شما ذخیره می‌شوند.';
  }

  const renderFavClubs = () => {
    if (!clubsContainer) return;
    const clubs = getFavoriteClubEntities();
    if (clubs.length === 0) {
      clubsContainer.className = '';
      clubsContainer.innerHTML = `
        <div class="state-box">
          <h3>هنوز باشگاهی به علاقه‌مندی‌ها اضافه نشده است</h3>
          <p>می‌توانید از دایرکتوری باشگاه‌های مشهد مجموعه‌های موردنظر خود را نشان کنید.</p>
          <a href="/pages/clubs.html" class="btn btn-primary">مشاهده باشگاه‌های مشهد</a>
        </div>
      `;
      return;
    }
    clubsContainer.className = 'grid-3';
    clubsContainer.innerHTML = clubs.map(createClubCardHtml).join('');
    bindClubCardActions(clubsContainer, (type) => {
      if (type === 'favorite') renderFavClubs();
    });
  };

  const renderFavSports = () => {
    if (!sportsContainer) return;
    const sports = getFavoriteSportEntities();
    if (sports.length === 0) {
      sportsContainer.className = '';
      sportsContainer.innerHTML = `
        <div class="state-box">
          <h3>هنوز رشته ورزشی موردعلاقه‌ای ثبت نشده است</h3>
          <p>در بخش رشته‌های ورزشی می‌توانید از میان ۳۵ رشته موارد دلخواهتان را انتخاب کنید.</p>
          <a href="/pages/sports.html" class="btn btn-secondary">مشاهده رشته‌های ورزشی</a>
        </div>
      `;
      return;
    }

    sportsContainer.className = 'grid-3';
    sportsContainer.innerHTML = sports
      .map((sp) => {
        const cat = getCategoryById(sp.categoryId);
        return `
          <article class="club-card">
            <div class="club-card-media">
              <img src="${escapeHtml(sp.image)}" alt="${escapeHtml(sp.name)}" loading="lazy" referrerpolicy="no-referrer" />
            </div>
            <div class="club-card-body">
              <div class="meta-inline">
                <span>${escapeHtml(cat ? cat.name : '')}</span>
              </div>
              <h3 class="club-card-title">
                <a href="/pages/sport-detail.html?id=${encodeURIComponent(sp.id)}">${escapeHtml(sp.name)}</a>
              </h3>
              <p class="club-card-address">${escapeHtml(sp.shortSummary)}</p>
              <div class="club-card-footer">
                <button type="button" class="btn btn-danger btn-sm js-remove-fav-sport" data-sport-id="${escapeHtml(sp.id)}">حذف</button>
                <a href="/pages/sport-detail.html?id=${encodeURIComponent(sp.id)}" class="btn btn-secondary btn-sm">مشاهده رشته</a>
              </div>
            </div>
          </article>
        `;
      })
      .join('');

    sportsContainer.querySelectorAll('.js-remove-fav-sport').forEach((btn) => {
      btn.addEventListener('click', () => {
        toggleSportFavorite(btn.dataset.sportId);
        showToast({ type: 'info', message: 'رشته ورزشی از علاقه‌مندی‌ها حذف شد.' });
        renderFavSports();
      });
    });
  };

  renderFavClubs();
  renderFavSports();
}
