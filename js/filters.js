/**
 * SPORTLINK — Pure Filtering, Sorting & Pagination Logic
 */

export const DESKTOP_PAGE_SIZE = 12;
export const MOBILE_PAGE_SIZE = 6;

export const SORT_OPTIONS = [
  { id: 'relevant', label: 'مرتبط‌ترین' },
  { id: 'newest', label: 'جدیدترین' },
  { id: 'oldest', label: 'قدیمی‌ترین' },
  { id: 'alpha_asc', label: 'نام الفبایی (الف تا ی)' },
  { id: 'alpha_desc', label: 'نام الفبایی معکوس (ی تا الف)' },
];

export const PRICE_RANGES = [
  { id: 'all', label: 'همه بازه‌ها' },
  { id: 'under_1m', label: 'تا ۱ میلیون تومان', max: 1000000 },
  { id: '1m_2m', label: '۱ تا ۲ میلیون تومان', min: 1000000, max: 2000000 },
  { id: 'over_2m', label: 'بیش از ۲ میلیون تومان', min: 2000000 },
  { id: 'inquiry_only', label: 'فقط استعلام قیمت' },
];

/**
 * Filters published Mashhad clubs according to active criteria.
 */
export function filterClubs(clubs, criteria = {}, sportsList = []) {
  const {
    query = '',
    neighborhood = '',
    sport = '',
    type = '',
    priceRange = 'all',
    facilities = [],
  } = criteria;

  const q = String(query || '').trim().toLowerCase();
  const sportMap = new Map(sportsList.map((s) => [s.id, s.name.toLowerCase()]));

  return clubs.filter((club) => {
    if (club.status !== 'published') return false;

    if (neighborhood && club.neighborhood !== neighborhood) {
      return false;
    }

    if (type && club.type !== type) {
      return false;
    }

    if (sport && !(club.sports || []).includes(sport)) {
      return false;
    }

    if (facilities && facilities.length > 0) {
      const clubFacs = club.facilities || [];
      const hasAll = facilities.every((f) => clubFacs.includes(f));
      if (!hasAll) return false;
    }

    // Price filter only matches clubs with valid price information (unless inquiry_only selected)
    if (priceRange && priceRange !== 'all') {
      const p = club.priceInfo || { hasPrice: false };
      if (priceRange === 'inquiry_only') {
        if (p.hasPrice) return false;
      } else {
        if (!p.hasPrice) return false;
        const min = Number(p.minToman || 0);
        const max = Number(p.maxToman || min);
        if (priceRange === 'under_1m' && min > 1000000) return false;
        if (priceRange === '1m_2m' && (max < 1000000 || min > 2000000)) return false;
        if (priceRange === 'over_2m' && max < 2000000) return false;
      }
    }

    if (q) {
      const sportNames = (club.sports || []).map((id) => sportMap.get(id) || '').join(' ');
      const haystack = `${club.name} ${club.neighborhood} ${club.type} ${club.shortAddress} ${club.shortDescription} ${sportNames}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

export function sortClubs(clubs, sortBy = 'relevant', query = '') {
  const copy = [...clubs];
  const q = String(query || '').trim().toLowerCase();

  switch (sortBy) {
    case 'newest':
      return copy.sort((a, b) => (b.createdAtOrder || 0) - (a.createdAtOrder || 0));
    case 'oldest':
      return copy.sort((a, b) => (a.createdAtOrder || 0) - (b.createdAtOrder || 0));
    case 'alpha_asc':
      return copy.sort((a, b) => a.name.localeCompare(b.name, 'fa'));
    case 'alpha_desc':
      return copy.sort((a, b) => b.name.localeCompare(a.name, 'fa'));
    case 'relevant':
    default:
      return copy.sort((a, b) => {
        if (q) {
          const aNameMatch = a.name.toLowerCase().includes(q) ? 1 : 0;
          const bNameMatch = b.name.toLowerCase().includes(q) ? 1 : 0;
          if (aNameMatch !== bNameMatch) return bNameMatch - aNameMatch;
        }
        const aFeat = a.isFeatured ? 1 : 0;
        const bFeat = b.isFeatured ? 1 : 0;
        if (aFeat !== bFeat) return bFeat - aFeat;
        return (b.createdAtOrder || 0) - (a.createdAtOrder || 0);
      });
  }
}

export function paginateItems(items, page = 1, pageSize = DESKTOP_PAGE_SIZE) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  return {
    items: items.slice(start, end),
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
  };
}
