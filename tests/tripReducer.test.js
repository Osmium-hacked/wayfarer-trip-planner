import { describe, expect, it } from 'vitest';
import { historyReducer, initialHistory, tripReducer } from '../src/state/tripReducer.js';

const stop = (id) => ({ id, name: id });
const trip = () => ({
  id: 't1',
  title: 'T',
  days: [
    { id: 'd1', stops: [stop('a'), stop('b')] },
    { id: 'd2', stops: [stop('c')] },
  ],
  packingList: [],
  budget: [],
});
const ids = (t) => t.days.map((d) => d.stops.map((s) => s.id));

describe('tripReducer', () => {
  it('moves a stop within a day', () => {
    expect(ids(tripReducer(trip(), { type: 'moveStop', stopId: 'a', delta: 1 }))).toEqual([['b', 'a'], ['c']]);
  });

  it('moves a stop across the day boundary', () => {
    expect(ids(tripReducer(trip(), { type: 'moveStop', stopId: 'b', delta: 1 }))).toEqual([['a'], ['b', 'c']]);
    expect(ids(tripReducer(trip(), { type: 'moveStop', stopId: 'c', delta: -1 }))).toEqual([['a', 'b', 'c'], []]);
  });

  it('is a no-op at the very start or end', () => {
    const t = trip();
    expect(tripReducer(t, { type: 'moveStop', stopId: 'a', delta: -1 })).toBe(t);
    expect(tripReducer(t, { type: 'moveStop', stopId: 'c', delta: 1 })).toBe(t);
  });

  it('applies a drag-and-drop reorder', () => {
    const next = tripReducer(trip(), { type: 'reorder', columns: { d1: ['b'], d2: ['a', 'c'] } });
    expect(ids(next)).toEqual([['b'], ['a', 'c']]);
  });

  it('refuses a reorder that would lose or duplicate stops', () => {
    const t = trip();
    expect(tripReducer(t, { type: 'reorder', columns: { d1: ['a'], d2: ['c'] } })).toBe(t);
    expect(tripReducer(t, { type: 'reorder', columns: { d1: ['a', 'a'], d2: ['c'] } })).toBe(t);
  });

  it('restores a removed stop to its original position', () => {
    const removed = tripReducer(trip(), { type: 'removeStop', stopId: 'a' });
    const restored = tripReducer(removed, { type: 'restoreStop', stop: stop('a'), dayId: 'd1', index: 0 });
    expect(ids(restored)).toEqual([['a', 'b'], ['c']]);
  });

  it('keeps identity on AI replace', () => {
    const next = tripReducer({ ...trip(), prompt: 'p', createdAt: 1 }, { type: 'replace', trip: { ...trip(), id: 'other', title: 'New' } });
    expect(next).toMatchObject({ id: 't1', prompt: 'p', createdAt: 1, title: 'New' });
  });
});

describe('historyReducer', () => {
  it('supports undo and redo, and ignores no-op edits', () => {
    let s = historyReducer(initialHistory, { type: 'load', trip: trip() });
    s = historyReducer(s, { type: 'moveStop', stopId: 'a', delta: -1 }); // no-op
    expect(s.past).toHaveLength(0);
    s = historyReducer(s, { type: 'removeStop', stopId: 'a' });
    expect(ids(s.present)).toEqual([['b'], ['c']]);
    s = historyReducer(s, { type: 'undo' });
    expect(ids(s.present)).toEqual([['a', 'b'], ['c']]);
    s = historyReducer(s, { type: 'redo' });
    expect(ids(s.present)).toEqual([['b'], ['c']]);
  });
});

describe('replace (AI refinement)', () => {
  it('keeps packing checkmarks for items that survive the refinement', () => {
    const before = { ...trip(), packingList: [{ id: 'p1', text: 'Sunscreen', checked: true }, { id: 'p2', text: 'Hat', checked: false }] };
    const refined = { ...trip(), packingList: [{ id: 'n1', text: 'sunscreen', checked: false }, { id: 'n2', text: 'Umbrella', checked: false }] };
    const next = tripReducer(before, { type: 'replace', trip: refined });
    expect(next.packingList.map((p) => p.checked)).toEqual([true, false]);
  });
});
