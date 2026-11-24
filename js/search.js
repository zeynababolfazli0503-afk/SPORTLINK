/**
 * SPORTLINK — Pure 2-Stage Search Suggestions & History Logic
 * Stage 1: Live suggestions while typing (matching clubs, sports, Mashhad neighborhoods)
 * Stage 2: Navigate to results page on Enter or submit
 * Search history: Last 5 searches stored in browser, single delete, clear all.
 */

import { KEYS, readJSON, writeJSON, removeKey } from './storage.js';
import { MASHHAD_NEIGHBORHOODS } from './data.js';

const MAX_HISTORY = 5;

export function getSearchSuggestions(query, mode = 'clubs', clubs = [], sports = []) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];

  const suggestions = [];

  if (mode === 'clubs' || mode === 'all') {
    for (const club of clubs) {
      if (club.status !== 'published') continue;
      if (
        club.name.toLowerCase().includes(q) ||
        club.neighborhood.toLowerCase().includes(q) ||
        club.shortAddress.toLowerCase().includes(q)
      ) {
        suggestions.push({
          kind: 'club',
          label: club.name,
          meta: `${club.type} · ${club.neighborhood}`,
          queryValue: club.name,
          href: `/pages/club-detail.html?id=${encodeURIComponent(club.id)}`,
        });
      }
      if (suggestions.length >= 4) break;
    }

    for (const hood of MASHHAD_NEIGHBORHOODS) {
      if (hood.toLowerCase().includes(q)) {
        suggestions.push({
          kind: 'neighborhood',
          label: `باشگاه‌های محله ${hood}`,
          meta: 'محله مشهد',
          queryValue: hood,
          href: `/pages/clubs.html?neighborhood=${encodeURIComponent(hood)}`,
        });
      }
    }
  }

  if (mode === 'sports' || mode === 'all') {
    let sportCount = 0;
    for (const sport of sports) {
      if (sport.name.toLowerCase().includes(q) || sport.shortSummary.toLowerCase().includes(q)) {
        suggestions.push({
          kind: 'sport',
          label: sport.name,
          meta: 'رشته ورزشی',
          queryValue: sport.name,
          href: `/pages/sport-detail.html?id=${encodeURIComponent(sport.id)}`,
        });
        sportCount += 1;
        if (sportCount >= 5) break;
      }
    }
  }

  return suggestions.slice(0, 7);
}

export function getSearchHistory() {
  const items = readJSON(KEYS.SEARCH_HISTORY, []);
  return Array.isArray(items) ? items.slice(0, MAX_HISTORY) : [];
}

export function addSearchHistory(term, mode = 'clubs') {
  const clean = String(term || '').trim();
  if (!clean) return getSearchHistory();
  const existing = getSearchHistory().filter((item) => !(item.term === clean && item.mode === mode));
  const updated = [{ term: clean, mode, id: `${Date.now()}` }, ...existing].slice(0, MAX_HISTORY);
  writeJSON(KEYS.SEARCH_HISTORY, updated);
  return updated;
}

export function removeSearchHistoryItem(id) {
  const updated = getSearchHistory().filter((item) => item.id !== id);
  writeJSON(KEYS.SEARCH_HISTORY, updated);
  return updated;
}

export function clearSearchHistory() {
  removeKey(KEYS.SEARCH_HISTORY);
  return [];
}

/**
 * A "search impression" is counted only when the user explicitly submits a
 * non-empty search query. Restoring a query from the URL, re-rendering after a
 * filter/sort/pagination change, resizing the window or loading more cards is
 * NOT a new impression. Re-submitting the exact same query is ignored too.
 */
export function isNewGenuineSearch(query, previousCountedQuery = '') {
  const next = String(query || '').trim();
  const previous = String(previousCountedQuery || '').trim();
  return next.length > 0 && next !== previous;
}

/** Returns a new club list with one impression added to each matched club. */
export function recordSearchImpressions(clubs, matchedIds, query) {
  if (!String(query || '').trim()) return clubs;
  const matched = new Set(matchedIds || []);
  return clubs.map((club) =>
    matched.has(club.id)
      ? { ...club, searchImpressions: (Number(club.searchImpressions) || 0) + 1 }
      : club
  );
}
