import { ItineraryError } from './errors.js';
import { createId } from './ids.js';

/**
 * The trust boundary between the model and the UI.
 * Takes whatever JSON the model produced and returns a trip in exactly the shape
 * the components expect, or throws an ItineraryError explaining why it can't.
 * Small deviations (renamed keys, "2 hours" instead of 120, a stop as a bare string)
 * are fixed silently; things we had to throw away are reported as `warnings`.
 */

export const CATEGORIES = ['sight', 'food', 'activity', 'nature', 'shopping', 'nightlife', 'transport', 'lodging', 'other'];
export const LIMITS = { days: 14, stopsPerDay: 12, packing: 30, budget: 10 };

const CATEGORY_ALIASES = [
  ['food', ['restaurant', 'cafe', 'café', 'coffee', 'dining', 'meal', 'breakfast', 'lunch', 'dinner', 'brunch', 'eat', 'food', 'bakery', 'market']],
  ['sight', ['museum', 'landmark', 'sightseeing', 'monument', 'gallery', 'church', 'temple', 'palace', 'castle', 'historic', 'culture', 'attraction']],
  ['nature', ['park', 'hike', 'hiking', 'beach', 'garden', 'nature', 'outdoor', 'mountain', 'lake', 'viewpoint']],
  ['nightlife', ['bar', 'pub', 'club', 'night', 'cocktail', 'wine', 'drinks']],
  ['shopping', ['shop', 'store', 'mall', 'boutique']],
  ['transport', ['transport', 'transit', 'travel', 'train', 'flight', 'bus', 'transfer', 'drive', 'ferry']],
  ['lodging', ['hotel', 'hostel', 'lodging', 'accommodation', 'check-in', 'check in', 'stay']],
  ['activity', ['activity', 'tour', 'experience', 'class', 'show', 'spa', 'adventure']],
];

const DAY_KEYS = ['days', 'itinerary', 'schedule', 'plan', 'dailyPlan', 'daily_plan'];
const STOP_KEYS = ['stops', 'activities', 'items', 'schedule', 'places', 'events', 'plan'];
const CURRENCY_SYMBOLS = { $: 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR', '₩': 'KRW', '฿': 'THB' };

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);

export function cleanText(value, max = 400) {
  if (Array.isArray(value)) value = value.filter((v) => typeof v === 'string').join('; ');
  if (typeof value === 'number' && Number.isFinite(value)) value = String(value);
  if (typeof value !== 'string') return '';
  const s = value.replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

function firstArray(obj, keys) {
  for (const key of keys) if (Array.isArray(obj?.[key])) return obj[key];
  return null;
}

function firstText(obj, keys, max) {
  for (const key of keys) {
    const t = cleanText(obj?.[key], max);
    if (t) return t;
  }
  return '';
}

export function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const match = value.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function toMinutes(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  if (typeof value !== 'string') return null;
  const s = value.toLowerCase();
  const hours = s.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/);
  const mins = s.match(/(\d+)\s*(m|min|mins|minute|minutes)\b/);
  if (hours || mins) {
    const total = (hours ? parseFloat(hours[1]) * 60 : 0) + (mins ? parseInt(mins[1], 10) : 0);
    return total > 0 ? Math.round(total) : null;
  }
  const n = toNumber(s);
  return n && n > 0 ? Math.round(n) : null;
}

/** "9:30 pm" → "21:30", "09:00" → "09:00", "Morning" → "Morning", garbage → "". */
export function toTime(value) {
  const raw = cleanText(value, 24);
  if (!raw) return '';
  const m = raw.toLowerCase().match(/^(\d{1,2})(?:[:.h](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/);
  if (!m) return /^[a-z][a-z\s-]{1,14}$/i.test(raw) ? raw : '';
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const meridiem = m[3]?.[0];
  if (meridiem === 'p' && hour < 12) hour += 12;
  if (meridiem === 'a' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return '';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function toCategory(value) {
  const s = cleanText(value, 40).toLowerCase();
  if (!s) return 'other';
  if (CATEGORIES.includes(s)) return s;
  for (const [category, words] of CATEGORY_ALIASES) {
    if (words.some((w) => s.includes(w))) return category;
  }
  return 'other';
}

function toCurrency(value) {
  const s = cleanText(value, 10);
  if (CURRENCY_SYMBOLS[s]) return CURRENCY_SYMBOLS[s];
  return /^[a-z]{3}$/i.test(s) ? s.toUpperCase() : '';
}

function clampOrNull(n, min, max) {
  return n == null ? null : Math.min(max, Math.max(min, n));
}

export function normalizeStop(raw) {
  if (typeof raw === 'string') {
    const name = cleanText(raw, 120);
    return name ? createStop({ name }) : null;
  }
  if (!isObj(raw)) return null;
  const name = firstText(raw, ['name', 'title', 'activity', 'place', 'attraction'], 120);
  if (!name) return null;
  const cost = toNumber(raw.cost ?? raw.price ?? raw.costEstimate ?? raw.estimatedCost);
  return createStop({
    name,
    time: toTime(raw.time ?? raw.startTime ?? raw.start),
    category: toCategory(raw.category ?? raw.type),
    description: firstText(raw, ['description', 'details', 'summary', 'notes'], 600),
    durationMinutes: clampOrNull(toMinutes(raw.durationMinutes ?? raw.duration_minutes ?? raw.duration), 5, 24 * 60),
    cost: cost != null && cost >= 0 ? Math.round(cost * 100) / 100 : null,
    tip: firstText(raw, ['tip', 'tips', 'insiderTip', 'insider_tip'], 300),
    location: firstText(raw, ['location', 'address', 'neighborhood', 'neighbourhood', 'area'], 160),
  });
}

/** Also used by the "Add stop" form so user-made stops have the same shape. */
export function createStop(fields) {
  return {
    id: createId('stop'),
    name: '',
    time: '',
    category: 'other',
    description: '',
    durationMinutes: null,
    cost: null,
    tip: '',
    location: '',
    ...fields,
  };
}

function normalizePacking(data, warnings) {
  const raw = data.packingList ?? data.packing_list ?? data.packing ?? data.whatToPack;
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    warnings.push('The packing list was in an unexpected format and was left out.');
    return [];
  }
  const seen = new Set();
  return raw
    .map((item) => (isObj(item) ? firstText(item, ['item', 'name', 'text', 'title'], 80) : cleanText(item, 80)))
    .filter((text) => text && !seen.has(text.toLowerCase()) && seen.add(text.toLowerCase()))
    .slice(0, LIMITS.packing)
    .map((text) => ({ id: createId('pack'), text, checked: false }));
}

function normalizeBudget(data, warnings) {
  const raw = data.budget ?? data.budgetBreakdown ?? data.costs;
  if (raw == null) return [];
  let entries;
  if (Array.isArray(raw)) {
    entries = raw.map((b) =>
      isObj(b) ? [firstText(b, ['category', 'name', 'label', 'item'], 40), toNumber(b.amount ?? b.cost ?? b.value)] : [null, null],
    );
  } else if (isObj(raw)) {
    entries = Object.entries(raw).map(([k, v]) => [cleanText(k, 40), toNumber(v)]);
  } else {
    warnings.push('The budget breakdown was in an unexpected format and was left out.');
    return [];
  }
  return entries
    .filter(([category, amount]) => category && amount != null && amount > 0)
    .slice(0, LIMITS.budget)
    .map(([category, amount]) => ({ category, amount: Math.round(amount) }));
}

/**
 * @param {unknown} input     parsed JSON from the model
 * @param {{partial?: boolean}} options  partial=true for streaming previews: never throws on missing pieces
 * @returns {{ itinerary: object, warnings: string[] }}
 */
export function normalizeItinerary(input, { partial = false } = {}) {
  const warnings = [];
  let data = Array.isArray(input) ? { days: input } : input;

  if (!isObj(data)) {
    throw new ItineraryError('shape', 'The AI returned something other than an itinerary object.');
  }
  if (data.error && !firstArray(data, DAY_KEYS)) {
    const message = cleanText(data.message, 300) || cleanText(data.error?.message ?? data.error, 300);
    throw new ItineraryError('not_a_trip', message || 'That doesn’t look like a trip request.');
  }
  // Unwrap {"itinerary": {...}} / {"trip": {...}} style nesting.
  for (const key of ['itinerary', 'trip', 'plan', 'data', 'result']) {
    if (isObj(data[key]) && !firstArray(data, DAY_KEYS)) {
      data = { ...data, ...data[key] };
      break;
    }
  }

  const rawDays = firstArray(data, DAY_KEYS);
  if (!rawDays && !partial) {
    throw new ItineraryError('shape', 'The answer didn’t include a list of days.');
  }

  let droppedStops = 0;
  let droppedDays = 0;
  let trimmedStops = 0;
  const days = [];
  for (const rawDay of (rawDays ?? []).slice(0, LIMITS.days)) {
    let title = '';
    let rawStops = null;
    if (Array.isArray(rawDay)) rawStops = rawDay;
    else if (isObj(rawDay)) {
      title = firstText(rawDay, ['title', 'theme', 'name', 'summary'], 80);
      rawStops = firstArray(rawDay, STOP_KEYS);
    } else {
      droppedDays++;
      continue;
    }
    const stops = [];
    for (const rawStop of rawStops ?? []) {
      const stop = normalizeStop(rawStop);
      if (stop) stops.push(stop);
      else droppedStops++;
    }
    if (stops.length > LIMITS.stopsPerDay) {
      trimmedStops += stops.length - LIMITS.stopsPerDay;
      stops.length = LIMITS.stopsPerDay;
    }
    days.push({ id: createId('day'), title, stops });
  }

  const totalStops = days.reduce((sum, d) => sum + d.stops.length, 0);
  if (!partial && totalStops === 0) {
    throw new ItineraryError('empty', 'The itinerary came back without any stops in it.');
  }

  if (rawDays && rawDays.length > LIMITS.days) {
    warnings.push(`The AI planned ${rawDays.length} days; only the first ${LIMITS.days} are shown.`);
  }
  if (droppedDays) warnings.push(`${droppedDays} ${plural(droppedDays, 'day')} in an unreadable format ${plural(droppedDays, 'was', 'were')} skipped.`);
  if (droppedStops) warnings.push(`${droppedStops} ${plural(droppedStops, 'stop')} without a name ${plural(droppedStops, 'was', 'were')} skipped.`);
  if (trimmedStops) warnings.push(`${trimmedStops} extra ${plural(trimmedStops, 'stop')} beyond ${LIMITS.stopsPerDay} per day ${plural(trimmedStops, 'was', 'were')} trimmed.`);
  const emptyDays = days.map((d, i) => (d.stops.length ? null : i + 1)).filter(Boolean);
  if (emptyDays.length && !partial) {
    warnings.push(`Day ${emptyDays.join(', ')} came back with no stops. Add your own or ask the AI to fill ${plural(emptyDays.length, 'it', 'them')}.`);
  }

  const destination = firstText(data, ['destination', 'location', 'city', 'place'], 80);
  const title =
    firstText(data, ['title', 'name', 'tripName', 'trip_name'], 100) ||
    (destination ? `${days.length} days in ${destination}` : `Your ${days.length}-day trip`);

  const itinerary = {
    id: createId('trip'),
    title,
    destination,
    summary: firstText(data, ['summary', 'description', 'overview'], 400),
    currency: toCurrency(data.currency),
    days,
    packingList: normalizePacking(data, warnings),
    budget: normalizeBudget(data, warnings),
  };

  return { itinerary, warnings: partial ? [] : warnings };
}
