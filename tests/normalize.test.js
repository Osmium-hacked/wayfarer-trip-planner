import { describe, expect, it } from 'vitest';
import { normalizeItinerary, toCategory, toMinutes, toTime } from '../src/lib/normalize.js';

const valid = {
  title: 'Lisbon',
  destination: 'Lisbon, Portugal',
  currency: 'EUR',
  days: [{ title: 'Alfama', stops: [{ name: 'Castelo', time: '09:00', category: 'sight', durationMinutes: 90, cost: 15 }] }],
  packingList: ['Shoes'],
  budget: [{ category: 'Food', amount: 200 }],
};

describe('normalizeItinerary', () => {
  it('accepts a well-formed itinerary with no warnings', () => {
    const { itinerary, warnings } = normalizeItinerary(valid);
    expect(warnings).toEqual([]);
    expect(itinerary.days[0].stops[0]).toMatchObject({ name: 'Castelo', time: '09:00', category: 'sight', durationMinutes: 90, cost: 15 });
    expect(itinerary.days[0].stops[0].id).toMatch(/^stop_/);
    expect(itinerary.packingList[0]).toMatchObject({ text: 'Shoes', checked: false });
  });

  it('fixes common shape drift: nesting, renamed keys, string values', () => {
    const { itinerary } = normalizeItinerary({
      itinerary: {
        days: [{ theme: 'Day one', activities: [{ title: 'Museum', duration: '2 hours', cost: '€12', type: 'Restaurant', time: '3:30 pm' }, 'Gelato'] }],
      },
    });
    const [museum, gelato] = itinerary.days[0].stops;
    expect(itinerary.days[0].title).toBe('Day one');
    expect(museum).toMatchObject({ name: 'Museum', durationMinutes: 120, cost: 12, category: 'food', time: '15:30' });
    expect(gelato.name).toBe('Gelato');
  });

  it('accepts a bare array of days', () => {
    const { itinerary } = normalizeItinerary([{ stops: [{ name: 'A' }] }]);
    expect(itinerary.days).toHaveLength(1);
    expect(itinerary.title).toBe('Your 1-day trip');
  });

  it('drops unnamed stops and reports it', () => {
    const { itinerary, warnings } = normalizeItinerary({ days: [{ stops: [{ name: 'A' }, { description: 'no name' }, null] }] });
    expect(itinerary.days[0].stops).toHaveLength(1);
    expect(warnings).toContain('2 stops without a name were skipped.');
  });

  it('reports malformed optional sections without failing', () => {
    const { itinerary, warnings } = normalizeItinerary({ ...valid, budget: 'about 900 euros', packingList: 'stuff' });
    expect(itinerary.budget).toEqual([]);
    expect(warnings).toHaveLength(2);
  });

  it('throws shape when there are no days', () => {
    expect(() => normalizeItinerary({ trip: 'Paris', plan: 'Day 1: ...' })).toThrow(expect.objectContaining({ kind: 'shape' }));
  });

  it('throws empty when days have no usable stops', () => {
    expect(() => normalizeItinerary({ days: [{ stops: [] }, { stops: [{}] }] })).toThrow(expect.objectContaining({ kind: 'empty' }));
  });

  it('surfaces the model refusing a non-trip request', () => {
    expect(() => normalizeItinerary({ error: 'not_a_trip', message: 'Tell me where to go.' })).toThrow(
      expect.objectContaining({ kind: 'not_a_trip', message: 'Tell me where to go.' }),
    );
  });

  it('throws shape for non-objects', () => {
    expect(() => normalizeItinerary('hello')).toThrow(expect.objectContaining({ kind: 'shape' }));
    expect(() => normalizeItinerary(null)).toThrow(expect.objectContaining({ kind: 'shape' }));
  });

  it('never throws in partial (streaming) mode', () => {
    expect(() => normalizeItinerary({ title: 'x' }, { partial: true })).not.toThrow();
  });

  it('caps the number of days', () => {
    const days = Array.from({ length: 20 }, () => ({ stops: [{ name: 'x' }] }));
    const { itinerary, warnings } = normalizeItinerary({ days });
    expect(itinerary.days).toHaveLength(14);
    expect(warnings[0]).toMatch(/only the first 14/);
  });
});

describe('field coercion', () => {
  it.each([
    ['9:30 pm', '21:30'],
    ['12am', '00:00'],
    ['09:00', '09:00'],
    ['Morning', 'Morning'],
    ['99:99', ''],
    [42, ''],
  ])('toTime(%j) → %j', (input, expected) => expect(toTime(input)).toBe(expected));

  it.each([
    [90, 90],
    ['1.5 hours', 90],
    ['1h 15m', 75],
    ['45 min', 45],
    ['soon', null],
    [-5, null],
  ])('toMinutes(%j) → %j', (input, expected) => expect(toMinutes(input)).toBe(expected));

  it('maps unknown categories to other', () => {
    expect(toCategory('Bar & Pub')).toBe('nightlife');
    expect(toCategory('???')).toBe('other');
  });
});
