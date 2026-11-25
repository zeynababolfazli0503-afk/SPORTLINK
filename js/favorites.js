/**
 * SPORTLINK — Favorites Module (Clubs & Sports)
 * Guest users: persisted temporarily in LocalStorage under guest key.
 * Logged-in users: simulated per-user persistence in LocalStorage (API-ready).
 */

import { KEYS, readJSON, writeJSON, getClubs, getSportsList } from './storage.js';
import { getCurrentUser } from './auth.js';

function getFavoritesKey() {
  const user = getCurrentUser();
  return user ? `${KEYS.FAVORITES_USER_PREFIX}${user.id}` : KEYS.FAVORITES_GUEST;
}

export function getFavorites() {
  const data = readJSON(getFavoritesKey(), { clubs: [], sports: [] });
  return {
    clubs: Array.isArray(data?.clubs) ? data.clubs : [],
    sports: Array.isArray(data?.sports) ? data.sports : [],
  };
}

export function isClubFavorite(clubId) {
  return getFavorites().clubs.includes(clubId);
}

export function isSportFavorite(sportId) {
  return getFavorites().sports.includes(sportId);
}

export function toggleClubFavorite(clubId) {
  const fav = getFavorites();
  const exists = fav.clubs.includes(clubId);
  fav.clubs = exists ? fav.clubs.filter((id) => id !== clubId) : [clubId, ...fav.clubs];
  writeJSON(getFavoritesKey(), fav);
  return { added: !exists, favorites: fav };
}

export function toggleSportFavorite(sportId) {
  const fav = getFavorites();
  const exists = fav.sports.includes(sportId);
  fav.sports = exists ? fav.sports.filter((id) => id !== sportId) : [sportId, ...fav.sports];
  writeJSON(getFavoritesKey(), fav);
  return { added: !exists, favorites: fav };
}

export function getFavoriteClubEntities() {
  const ids = getFavorites().clubs;
  const published = getClubs().filter((c) => c.status === 'published');
  return ids.map((id) => published.find((c) => c.id === id)).filter(Boolean);
}

export function getFavoriteSportEntities() {
  const ids = getFavorites().sports;
  const sports = getSportsList();
  return ids.map((id) => sports.find((s) => s.id === id)).filter(Boolean);
}
