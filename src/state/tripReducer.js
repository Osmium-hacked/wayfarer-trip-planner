import { createId } from '../lib/ids.js';

/**
 * Trip state = undo/redo history around a pure trip reducer.
 * Every user edit and every AI refinement goes through here, so they are all undoable.
 */

export const initialHistory = { past: [], present: null, future: [] };
const HISTORY_LIMIT = 50;

export function historyReducer(state, action) {
  switch (action.type) {
    case 'load':
      return { past: [], present: action.trip, future: [] };
    case 'clear':
      return initialHistory;
    case 'undo': {
      if (!state.past.length) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
      };
    }
    case 'redo': {
      if (!state.future.length) return state;
      return {
        past: [...state.past, state.present],
        present: state.future[0],
        future: state.future.slice(1),
      };
    }
    default: {
      if (!state.present) return state;
      const next = tripReducer(state.present, action);
      if (next === state.present) return state; // no-op edits don't pollute history
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: { ...next, updatedAt: Date.now() },
        future: [],
      };
    }
  }
}

export function findStop(trip, stopId) {
  for (let d = 0; d < trip.days.length; d++) {
    const s = trip.days[d].stops.findIndex((stop) => stop.id === stopId);
    if (s !== -1) return { dayIndex: d, stopIndex: s, stop: trip.days[d].stops[s] };
  }
  return null;
}

function mapDay(trip, dayId, fn) {
  let changed = false;
  const days = trip.days.map((day) => {
    if (day.id !== dayId) return day;
    const next = fn(day);
    if (next !== day) changed = true;
    return next;
  });
  return changed ? { ...trip, days } : trip;
}

export function tripReducer(trip, action) {
  switch (action.type) {
    case 'replace': {
      // AI refinement: new content, same identity. The model only sees packing-item text,
      // so carry over which items the user already ticked.
      const checked = new Set(trip.packingList.filter((p) => p.checked).map((p) => p.text.toLowerCase()));
      const packingList = (action.trip.packingList ?? []).map((p) =>
        checked.has(p.text.toLowerCase()) ? { ...p, checked: true } : p,
      );
      return { ...action.trip, packingList, id: trip.id, prompt: trip.prompt, createdAt: trip.createdAt };
    }

    case 'removeStop': {
      const loc = findStop(trip, action.stopId);
      if (!loc) return trip;
      return mapDay(trip, trip.days[loc.dayIndex].id, (day) => ({
        ...day,
        stops: day.stops.filter((s) => s.id !== action.stopId),
      }));
    }

    case 'addStop':
      return mapDay(trip, action.dayId, (day) => ({ ...day, stops: [...day.stops, action.stop] }));

    // Targeted undo for a removal: puts the stop back where it was, even if other edits happened since.
    case 'restoreStop': {
      if (findStop(trip, action.stop.id)) return trip;
      const dayId = trip.days.some((d) => d.id === action.dayId) ? action.dayId : trip.days[0]?.id;
      return mapDay(trip, dayId, (day) => {
        const stops = day.stops.slice();
        stops.splice(Math.min(action.index, stops.length), 0, action.stop);
        return { ...day, stops };
      });
    }

    // Move by ±1; past the edge of a day the stop hops to the neighbouring day.
    case 'moveStop': {
      const loc = findStop(trip, action.stopId);
      if (!loc) return trip;
      const { dayIndex, stopIndex, stop } = loc;
      const target = stopIndex + action.delta;
      const days = trip.days.slice();
      const source = days[dayIndex].stops.filter((s) => s.id !== stop.id);

      if (target < 0) {
        if (dayIndex === 0) return trip;
        days[dayIndex - 1] = { ...days[dayIndex - 1], stops: [...days[dayIndex - 1].stops, stop] };
      } else if (target > source.length) {
        if (dayIndex === days.length - 1) return trip;
        days[dayIndex + 1] = { ...days[dayIndex + 1], stops: [stop, ...days[dayIndex + 1].stops] };
      } else {
        source.splice(target, 0, stop);
      }
      days[dayIndex] = { ...days[dayIndex], stops: source };
      return { ...trip, days };
    }

    case 'moveStopToDay': {
      const loc = findStop(trip, action.stopId);
      if (!loc || trip.days[loc.dayIndex].id === action.dayId) return trip;
      const days = trip.days.map((day, i) => {
        if (i === loc.dayIndex) return { ...day, stops: day.stops.filter((s) => s.id !== action.stopId) };
        if (day.id === action.dayId) return { ...day, stops: [...day.stops, loc.stop] };
        return day;
      });
      return { ...trip, days };
    }

    // Drag-and-drop result: { [dayId]: stopId[] } for every day.
    case 'reorder': {
      const byId = new Map();
      trip.days.forEach((d) => d.stops.forEach((s) => byId.set(s.id, s)));
      const ids = Object.values(action.columns).flat();
      // Refuse anything that would lose or duplicate a stop.
      if (ids.length !== byId.size || new Set(ids).size !== ids.length || !ids.every((id) => byId.has(id))) return trip;
      let changed = false;
      const days = trip.days.map((day) => {
        const order = action.columns[day.id] ?? [];
        const same = order.length === day.stops.length && order.every((id, i) => day.stops[i].id === id);
        if (same) return day;
        changed = true;
        return { ...day, stops: order.map((id) => byId.get(id)) };
      });
      return changed ? { ...trip, days } : trip;
    }

    case 'addDay':
      return { ...trip, days: [...trip.days, { id: createId('day'), title: '', stops: [] }] };

    case 'removeDay':
      if (trip.days.length <= 1) return trip;
      return { ...trip, days: trip.days.filter((d) => d.id !== action.dayId) };

    case 'restoreDay': {
      if (trip.days.some((d) => d.id === action.day.id)) return trip;
      const days = trip.days.slice();
      days.splice(Math.min(action.index, days.length), 0, action.day);
      return { ...trip, days };
    }

    case 'togglePacking':
      return {
        ...trip,
        packingList: trip.packingList.map((item) => (item.id === action.itemId ? { ...item, checked: !item.checked } : item)),
      };

    case 'addPacking': {
      const text = action.text.trim();
      if (!text) return trip;
      return { ...trip, packingList: [...trip.packingList, { id: createId('pack'), text, checked: false }] };
    }

    case 'removePacking':
      return { ...trip, packingList: trip.packingList.filter((item) => item.id !== action.itemId) };

    default:
      return trip;
  }
}

/** What we send back to the model for refinement: content only, no ids or UI flags. */
export function toModelShape(trip) {
  return {
    title: trip.title,
    destination: trip.destination,
    summary: trip.summary,
    currency: trip.currency,
    days: trip.days.map((d) => ({
      title: d.title,
      stops: d.stops.map(({ id: _id, ...stop }) => stop),
    })),
    packingList: trip.packingList.map((p) => p.text),
    budget: trip.budget,
  };
}

export function tripStats(trip) {
  const stops = trip.days.reduce((n, d) => n + d.stops.length, 0);
  const budgetTotal = trip.budget.reduce((sum, b) => sum + b.amount, 0);
  return { days: trip.days.length, stops, budgetTotal };
}
