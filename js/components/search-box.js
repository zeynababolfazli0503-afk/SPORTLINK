/**
 * SPORTLINK — Reusable 2-Stage Search Box + 5-Item History Dropdown
 */

import { getPublishedClubs, getSportsList } from '../storage.js';
import {
  getSearchSuggestions,
  getSearchHistory,
  addSearchHistory,
  removeSearchHistoryItem,
  clearSearchHistory,
} from '../search.js';
import { escapeHtml } from './ui.js';

export function bindSearchBox({
  inputEl,
  dropdownEl,
  formEl,
  getMode = () => 'clubs',
  onSubmitSearch,
  clearOnPageLeave = false,
}) {
  if (!inputEl || !dropdownEl) return;

  const clubs = getPublishedClubs();
  const sports = getSportsList();

  const renderDropdown = () => {
    const val = inputEl.value.trim();
    const mode = getMode();

    if (!val) {
      const history = getSearchHistory();
      if (history.length === 0) {
        dropdownEl.hidden = true;
        dropdownEl.innerHTML = '';
        return;
      }
      dropdownEl.innerHTML = `
        <div class="search-dropdown-header">
          <span>جست‌وجوهای اخیر</span>
          <button type="button" class="btn btn-ghost btn-sm js-clear-history" style="padding:0.2rem 0.5rem;">پاک‌کردن همه</button>
        </div>
        <div>
          ${history
            .map(
              (item) => `
              <div class="search-suggestion-row">
                <button type="button" class="search-suggestion-link js-pick-history" data-term="${escapeHtml(item.term)}" data-mode="${escapeHtml(item.mode)}">
                  <span>${escapeHtml(item.term)}</span>
                  <span style="font-size:0.75rem;color:var(--text-muted);">${item.mode === 'sports' ? 'رشته‌ها' : 'باشگاه‌ها'}</span>
                </button>
                <button type="button" class="btn-icon js-del-history" data-id="${escapeHtml(item.id)}" aria-label="حذف ${escapeHtml(item.term)} از تاریخچه">✕</button>
              </div>
            `
            )
            .join('')}
        </div>
      `;
      dropdownEl.hidden = false;

      dropdownEl.querySelector('.js-clear-history')?.addEventListener('click', (e) => {
        e.stopPropagation();
        clearSearchHistory();
        renderDropdown();
      });

      dropdownEl.querySelectorAll('.js-del-history').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          removeSearchHistoryItem(btn.dataset.id);
          renderDropdown();
        });
      });

      dropdownEl.querySelectorAll('.js-pick-history').forEach((btn) => {
        btn.addEventListener('click', () => {
          const term = btn.dataset.term || '';
          const histMode = btn.dataset.mode || 'clubs';
          inputEl.value = term;
          dropdownEl.hidden = true;
          addSearchHistory(term, histMode);
          if (onSubmitSearch) onSubmitSearch(term, histMode);
        });
      });
      return;
    }

    const suggestions = getSearchSuggestions(val, mode, clubs, sports);
    if (suggestions.length === 0) {
      dropdownEl.innerHTML = `
        <div class="search-suggestion-row">
          <span style="font-size:0.875rem;color:var(--text-muted);">پیشنهاد مستقیمی یافت نشد — برای جست‌وجوی کامل Enter بزنید.</span>
        </div>
      `;
      dropdownEl.hidden = false;
      return;
    }

    dropdownEl.innerHTML = `
      <div class="search-dropdown-header">
        <span>پیشنهادهای سریع</span>
      </div>
      <div>
        ${suggestions
          .map(
            (s) => `
            <div class="search-suggestion-row">
              <a href="${escapeHtml(s.href)}" class="search-suggestion-link js-pick-suggestion" data-term="${escapeHtml(s.queryValue)}">
                <span>${escapeHtml(s.label)}</span>
                <span style="font-size:0.75rem;color:var(--text-muted);">${escapeHtml(s.meta)}</span>
              </a>
            </div>
          `
          )
          .join('')}
      </div>
    `;
    dropdownEl.hidden = false;

    dropdownEl.querySelectorAll('.js-pick-suggestion').forEach((link) => {
      link.addEventListener('click', () => {
        addSearchHistory(link.dataset.term || val, mode);
      });
    });
  };

  inputEl.addEventListener('focus', renderDropdown);
  inputEl.addEventListener('input', renderDropdown);

  document.addEventListener('click', (e) => {
    if (!dropdownEl.hidden && !dropdownEl.contains(e.target) && e.target !== inputEl) {
      dropdownEl.hidden = true;
    }
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dropdownEl.hidden = true;
    }
  });

  if (formEl) {
    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const term = inputEl.value.trim();
      const mode = getMode();
      if (term) {
        addSearchHistory(term, mode);
      }
      dropdownEl.hidden = true;
      if (onSubmitSearch) onSubmitSearch(term, mode);
    });
  }

  if (clearOnPageLeave) {
    window.addEventListener('pagehide', () => {
      inputEl.value = '';
    });
  }
}
