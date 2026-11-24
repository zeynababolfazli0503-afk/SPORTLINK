/**
 * SPORTLINK — Compare Clubs Page Controller (Max 2 Clubs)
 * Responsive: Desktop comparison table + Mobile stacked comparison cards.
 */

import { getPublishedClubs } from '../storage.js';
import { getCurrentUser } from '../auth.js';
import {
  getCompareIds,
  getComparedClubs,
  removeCompareClub,
  clearCompare,
  buildComparisonRows,
} from '../comparison.js';
import { KEYS, writeJSON } from '../storage.js';
import { escapeHtml, showToast } from '../components/ui.js';

export function initComparePage() {
  const published = getPublishedClubs();
  const user = getCurrentUser();
  const guestNotice = document.getElementById('compare-guest-notice');
  const selectorsWrap = document.getElementById('compare-selectors');
  const contentWrap = document.getElementById('compare-content');

  if (guestNotice) {
    guestNotice.hidden = Boolean(user);
  }

  const render = () => {
    const ids = getCompareIds();
    const selected = getComparedClubs();
    const clubA = selected[0] || null;
    const clubB = selected[1] || null;

    if (selectorsWrap) {
      selectorsWrap.innerHTML = `
        <div class="card">
          <div class="form-row-2" style="align-items:end;">
            <div class="form-group">
              <label class="form-label" for="compare-select-a">باشگاه اول</label>
              <select id="compare-select-a" class="form-select">
                <option value="">انتخاب باشگاه...</option>
                ${published
                  .map(
                    (c) =>
                      `<option value="${escapeHtml(c.id)}" ${ids[0] === c.id ? 'selected' : ''} ${ids[1] === c.id ? 'disabled' : ''}>${escapeHtml(c.name)} (${escapeHtml(c.neighborhood)})</option>`
                  )
                  .join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="compare-select-b">باشگاه دوم</label>
              <select id="compare-select-b" class="form-select">
                <option value="">انتخاب باشگاه...</option>
                ${published
                  .map(
                    (c) =>
                      `<option value="${escapeHtml(c.id)}" ${ids[1] === c.id ? 'selected' : ''} ${ids[0] === c.id ? 'disabled' : ''}>${escapeHtml(c.name)} (${escapeHtml(c.neighborhood)})</option>`
                  )
                  .join('')}
              </select>
            </div>
          </div>
          ${
            ids.length > 0
              ? `<div style="margin-top:1rem;display:flex;justify-content:flex-end;">
                   <button type="button" class="btn btn-ghost btn-sm" id="compare-clear-all-btn">پاک‌کردن هر دو</button>
                 </div>`
              : ''
          }
        </div>
      `;

      const selA = document.getElementById('compare-select-a');
      const selB = document.getElementById('compare-select-b');

      const updatePair = () => {
        const next = [selA?.value, selB?.value].filter(Boolean);
        const unique = [...new Set(next)].slice(0, 2);
        writeJSON(KEYS.COMPARE, unique);
        render();
      };

      selA?.addEventListener('change', updatePair);
      selB?.addEventListener('change', updatePair);

      document.getElementById('compare-clear-all-btn')?.addEventListener('click', () => {
        clearCompare();
        showToast({ type: 'info', message: 'فهرست مقایسه پاک شد.' });
        render();
      });
    }

    if (!contentWrap) return;

    if (!clubA && !clubB) {
      contentWrap.innerHTML = `
        <div class="state-box">
          <h3>هنوز باشگاهی برای مقایسه انتخاب نشده است</h3>
          <p>حداکثر دو باشگاه از شهر مشهد را از فهرست بالا یا از دایرکتوری باشگاه‌ها انتخاب کنید تا مشخصات آن‌ها را کنار هم ببینید.</p>
          <a href="/pages/clubs.html" class="btn btn-primary">انتخاب از دایرکتوری باشگاه‌ها</a>
        </div>
      `;
      return;
    }

    const rows = buildComparisonRows(clubA, clubB);

    const desktopTableHtml = `
      <div class="table-wrap compare-table-desktop">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:180px;">شاخص مقایسه</th>
              <th>
                ${
                  clubA
                    ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
                         <a href="/pages/club-detail.html?id=${encodeURIComponent(clubA.id)}" style="color:var(--accent-gold);">${escapeHtml(clubA.name)}</a>
                         <button type="button" class="btn btn-ghost btn-sm js-remove-cmp" data-id="${escapeHtml(clubA.id)}" style="min-height:28px;padding:0.15rem 0.5rem;">حذف</button>
                       </div>`
                    : 'انتخاب نشده'
                }
              </th>
              <th>
                ${
                  clubB
                    ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
                         <a href="/pages/club-detail.html?id=${encodeURIComponent(clubB.id)}" style="color:var(--accent-gold);">${escapeHtml(clubB.name)}</a>
                         <button type="button" class="btn btn-ghost btn-sm js-remove-cmp" data-id="${escapeHtml(clubB.id)}" style="min-height:28px;padding:0.15rem 0.5rem;">حذف</button>
                       </div>`
                    : 'انتخاب نشده'
                }
              </th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (r) => `
                <tr>
                  <th scope="row" style="background:transparent;color:var(--text-muted);">${escapeHtml(r.label)}</th>
                  <td>${escapeHtml(r.valA)}</td>
                  <td>${escapeHtml(r.valB)}</td>
                </tr>
              `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;

    const mobileCardsHtml = `
      <div class="compare-mobile-cards">
        ${rows
          .map(
            (r) => `
            <div class="card" style="padding:1rem;">
              <div style="font-size:0.8125rem;color:var(--accent-gold);font-weight:700;margin-bottom:0.6rem;">${escapeHtml(r.label)}</div>
              <div style="display:flex;flex-direction:column;gap:0.5rem;font-size:0.875rem;">
                <div>
                  <strong style="color:var(--text-muted);display:block;font-size:0.75rem;">${escapeHtml(clubA ? clubA.name : 'باشگاه اول')}</strong>
                  <span>${escapeHtml(r.valA)}</span>
                </div>
                <div style="border-top:1px solid var(--border-subtle);padding-top:0.5rem;">
                  <strong style="color:var(--text-muted);display:block;font-size:0.75rem;">${escapeHtml(clubB ? clubB.name : 'باشگاه دوم')}</strong>
                  <span>${escapeHtml(r.valB)}</span>
                </div>
              </div>
            </div>
          `
          )
          .join('')}
      </div>
    `;

    contentWrap.innerHTML = desktopTableHtml + mobileCardsHtml;

    contentWrap.querySelectorAll('.js-remove-cmp').forEach((btn) => {
      btn.addEventListener('click', () => {
        removeCompareClub(btn.dataset.id);
        render();
      });
    });
  };

  render();
}
