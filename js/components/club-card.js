/**
 * SPORTLINK — Shared Club Card Component
 * Zero ratings or reviews per MVP constraints.
 * Supports: default, hover, favorite active, compare selected, image fallback.
 */

import { getSportById, getFacilityById, getClubOpenStatus } from '../data.js';
import { isClubFavorite, toggleClubFavorite } from '../favorites.js';
import { isInCompare, toggleCompareClub } from '../comparison.js';
import { escapeHtml, showToast } from './ui.js';

export function createClubCardHtml(club) {
  const isFav = isClubFavorite(club.id);
  const isCmp = isInCompare(club.id);
  const status = getClubOpenStatus(club.hours);
  const sportsNames = (club.sports || [])
    .slice(0, 3)
    .map((id) => getSportById(id)?.name || id)
    .join('، ');
  const topFacs = (club.facilities || [])
    .slice(0, 3)
    .map((id) => getFacilityById(id)?.name || id)
    .join('، ');

  const mainImage = club.images && club.images.length > 0 ? club.images[0] : '';

  return `
    <article class="club-card ${isCmp ? 'is-compared' : ''}" data-club-id="${escapeHtml(club.id)}">
      <div class="club-card-media">
        ${
          mainImage
            ? `<img src="${escapeHtml(mainImage)}" alt="${escapeHtml(club.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
               <div class="img-fallback" style="display:none;">
                 <span>تصویر مجموعه در دسترس نیست</span>
                 <small>${escapeHtml(club.name)}</small>
               </div>`
            : `<div class="img-fallback">
                 <span>تصویر مجموعه ثبت نشده</span>
                 <small>${escapeHtml(club.name)}</small>
               </div>`
        }
        <div class="club-card-overlay-actions">
          <button
            type="button"
            class="btn-icon js-fav-club-btn ${isFav ? 'is-active' : ''}"
            data-club-id="${escapeHtml(club.id)}"
            aria-label="${isFav ? 'حذف از علاقه‌مندی‌ها: ' : 'افزودن به علاقه‌مندی‌ها: '}${escapeHtml(club.name)}"
            aria-pressed="${isFav}"
            title="علاقه‌مندی"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>
          <button
            type="button"
            class="btn-icon js-cmp-club-btn ${isCmp ? 'is-active' : ''}"
            data-club-id="${escapeHtml(club.id)}"
            aria-label="${isCmp ? 'حذف از مقایسه: ' : 'افزودن به مقایسه: '}${escapeHtml(club.name)}"
            aria-pressed="${isCmp}"
            title="مقایسه"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
          </button>
        </div>
      </div>

      <div class="club-card-body">
        <div class="club-card-meta-row">
          <div class="meta-inline">
            <span>${escapeHtml(club.type)}</span>
            <span class="meta-sep" aria-hidden="true">·</span>
            <span>محله ${escapeHtml(club.neighborhood)}</span>
          </div>
          ${
            status.known
              ? `<span class="status-label ${status.isOpen ? 'is-open' : 'is-closed'}">${escapeHtml(status.label)}</span>`
              : ''
          }
        </div>

        <h3 class="club-card-title">
          <a href="/pages/club-detail.html?id=${encodeURIComponent(club.id)}">${escapeHtml(club.name)}</a>
        </h3>

        <p class="club-card-address">${escapeHtml(club.shortAddress)}</p>

        <div class="club-card-list-line">
          <strong>رشته‌ها:</strong> ${escapeHtml(sportsNames || 'ثبت نشده')}
        </div>
        <div class="club-card-list-line">
          <strong>امکانات شاخص:</strong> ${escapeHtml(topFacs || 'ثبت نشده')}
        </div>

        <div class="club-card-footer">
          <span style="font-size:0.8125rem;color:var(--gray-light);">
            ${escapeHtml(club.priceInfo?.hasPrice ? club.priceInfo.label.split('(')[0].trim() : 'استعلام قیمت')}
          </span>
          <a href="/pages/club-detail.html?id=${encodeURIComponent(club.id)}" class="btn btn-secondary btn-sm">مشاهده جزئیات</a>
        </div>
      </div>
    </article>
  `;
}

export function bindClubCardActions(rootEl, onStateChange) {
  if (!rootEl) return;

  rootEl.querySelectorAll('.js-fav-club-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const clubId = btn.dataset.clubId;
      const res = toggleClubFavorite(clubId);
      btn.classList.toggle('is-active', res.added);
      btn.setAttribute('aria-pressed', String(res.added));
      const svg = btn.querySelector('svg');
      if (svg) svg.setAttribute('fill', res.added ? 'currentColor' : 'none');
      showToast({
        type: 'success',
        message: res.added ? 'باشگاه به علاقه‌مندی‌ها اضافه شد.' : 'باشگاه از علاقه‌مندی‌ها حذف شد.',
      });
      if (onStateChange) onStateChange('favorite', res);
    });
  });

  rootEl.querySelectorAll('.js-cmp-club-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const clubId = btn.dataset.clubId;
      const res = toggleCompareClub(clubId);
      if (res.status === 'limit_reached') {
        showToast({
          type: 'warning',
          message: res.message,
          actionLabel: 'صفحه مقایسه',
          onAction: () => {
            window.location.href = '/pages/compare.html';
          },
        });
        return;
      }
      const added = res.status === 'added';
      btn.classList.toggle('is-active', added);
      btn.setAttribute('aria-pressed', String(added));
      btn.closest('.club-card')?.classList.toggle('is-compared', added);
      showToast({
        type: 'info',
        message: res.message,
        actionLabel: res.ids.length >= 2 ? 'مقایسه دو باشگاه' : undefined,
        onAction: res.ids.length >= 2 ? () => { window.location.href = '/pages/compare.html'; } : undefined,
      });
      if (onStateChange) onStateChange('compare', res);
    });
  });
}
