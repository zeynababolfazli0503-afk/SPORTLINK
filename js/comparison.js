/**
 * SPORTLINK — Club Comparison Module (Max 2 Clubs)
 * Guests can compare clubs temporarily; persistent saving notifies/ties to account when logged in.
 */

import { KEYS, readJSON, writeJSON, getClubs, getSportsList } from './storage.js';
import { FACILITIES } from './data.js';

export const MAX_COMPARE = 2;

export function getCompareIds() {
  const list = readJSON(KEYS.COMPARE, []);
  return Array.isArray(list) ? list.slice(0, MAX_COMPARE) : [];
}

export function isInCompare(clubId) {
  return getCompareIds().includes(clubId);
}

export function toggleCompareClub(clubId) {
  const current = getCompareIds();
  if (current.includes(clubId)) {
    const next = current.filter((id) => id !== clubId);
    writeJSON(KEYS.COMPARE, next);
    return { status: 'removed', ids: next, message: 'باشگاه از فهرست مقایسه حذف شد.' };
  }
  if (current.length >= MAX_COMPARE) {
    return {
      status: 'limit_reached',
      ids: current,
      message: 'حداکثر ۲ باشگاه را می‌توانید هم‌زمان مقایسه کنید. ابتدا یکی را حذف کنید.',
    };
  }
  const next = [...current, clubId];
  writeJSON(KEYS.COMPARE, next);
  return { status: 'added', ids: next, message: 'باشگاه به فهرست مقایسه اضافه شد.' };
}

export function removeCompareClub(clubId) {
  const next = getCompareIds().filter((id) => id !== clubId);
  writeJSON(KEYS.COMPARE, next);
  return next;
}

export function clearCompare() {
  writeJSON(KEYS.COMPARE, []);
  return [];
}

export function getComparedClubs() {
  const ids = getCompareIds();
  const clubs = getClubs().filter((c) => c.status === 'published');
  return ids.map((id) => clubs.find((c) => c.id === id)).filter(Boolean);
}

export function buildComparisonRows(clubA, clubB) {
  const sportsList = getSportsList();
  const sportName = (id) => sportsList.find((s) => s.id === id)?.name || id;
  const facName = (id) => FACILITIES.find((f) => f.id === id)?.name || id;

  const formatHours = (club) => {
    if (!club?.hours) return 'ثبت نشده';
    const sat = club.hours.sat;
    const fri = club.hours.fri;
    const satTxt = sat ? `${sat.open} تا ${sat.close}` : 'نامشخص';
    const friTxt = !fri || fri.open === 'closed' ? 'جمعه تعطیل' : `جمعه ${fri.open} تا ${fri.close}`;
    return `شنبه تا چهارشنبه: ${satTxt} · ${friTxt}`;
  };

  return [
    { label: 'نام باشگاه', valA: clubA?.name || '—', valB: clubB?.name || '—' },
    { label: 'نوع مجموعه', valA: clubA?.type || '—', valB: clubB?.type || '—' },
    { label: 'محله', valA: clubA?.neighborhood || '—', valB: clubB?.neighborhood || '—' },
    { label: 'آدرس', valA: clubA?.fullAddress || clubA?.shortAddress || '—', valB: clubB?.fullAddress || clubB?.shortAddress || '—' },
    {
      label: 'رشته‌های ورزشی',
      valA: clubA ? (clubA.sports || []).map(sportName).join('، ') : '—',
      valB: clubB ? (clubB.sports || []).map(sportName).join('، ') : '—',
    },
    {
      label: 'امکانات',
      valA: clubA ? (clubA.facilities || []).map(facName).join('، ') : '—',
      valB: clubB ? (clubB.facilities || []).map(facName).join('، ') : '—',
    },
    { label: 'ساعات فعالیت', valA: formatHours(clubA), valB: formatHours(clubB) },
    {
      label: 'قیمت',
      valA: clubA ? (clubA.priceInfo?.hasPrice ? clubA.priceInfo.label : 'استعلام قیمت') : '—',
      valB: clubB ? (clubB.priceInfo?.hasPrice ? clubB.priceInfo.label : 'استعلام قیمت') : '—',
    },
    { label: 'اطلاعات تماس', valA: clubA?.phone || '—', valB: clubB?.phone || '—' },
  ];
}
