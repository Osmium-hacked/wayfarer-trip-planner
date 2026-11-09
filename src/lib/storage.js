// localStorage can throw (private mode, quota, disabled storage) and can hold
// stale or hand-edited data, so every read is validated and every write is guarded.
const KEYS = { trips: 'wayfarer:trips:v1', current: 'wayfarer:current:v1' };
const MAX_TRIPS = 20;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Minimal structural check so a corrupted entry can't crash the UI. */
export function isValidTrip(trip) {
  return (
    trip &&
    typeof trip.id === 'string' &&
    typeof trip.title === 'string' &&
    Array.isArray(trip.days) &&
    trip.days.every(
      (d) => d && typeof d.id === 'string' && Array.isArray(d.stops) && d.stops.every((s) => s && typeof s.id === 'string' && typeof s.name === 'string'),
    )
  );
}

function withDefaults(trip) {
  return { packingList: [], budget: [], currency: '', summary: '', destination: '', prompt: '', ...trip };
}

export function loadTrips() {
  const list = read(KEYS.trips, []);
  return Array.isArray(list) ? list.filter(isValidTrip).map(withDefaults) : [];
}

export function saveTrip(trip) {
  if (!isValidTrip(trip)) return false;
  let trips = [trip, ...loadTrips().filter((t) => t.id !== trip.id)]
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, MAX_TRIPS);
  // On quota errors, drop the oldest trips until it fits.
  while (!write(KEYS.trips, trips)) {
    if (trips.length <= 1) return false;
    trips = trips.slice(0, -1);
  }
  return true;
}

export function deleteTrip(id) {
  write(KEYS.trips, loadTrips().filter((t) => t.id !== id));
  if (read(KEYS.current, null) === id) setCurrentTripId(null);
}

export function setCurrentTripId(id) {
  if (id) write(KEYS.current, id);
  else {
    try {
      localStorage.removeItem(KEYS.current);
    } catch {
      /* ignore */
    }
  }
}

export function loadCurrentTrip() {
  const id = read(KEYS.current, null);
  return id ? (loadTrips().find((t) => t.id === id) ?? null) : null;
}
