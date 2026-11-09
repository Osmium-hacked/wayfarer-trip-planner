import { describe, expect, it } from 'vitest';
import { extractJsonText, parseModelJson, parsePartialJson } from '../src/lib/parseJson.js';

describe('extractJsonText', () => {
  it('strips prose and code fences', () => {
    expect(extractJsonText('Sure! Here you go:\n```json\n{"a":1}\n```\nEnjoy')).toBe('{"a":1}');
  });
  it('drops <think> blocks from reasoning models', () => {
    expect(extractJsonText('<think>hmm {not this}</think>{"a":1}')).toBe('{"a":1}');
  });
});

describe('parseModelJson', () => {
  it('parses clean JSON', () => {
    expect(parseModelJson('{"days":[]}')).toEqual({ days: [] });
  });
  it('ignores trailing chatter after the object', () => {
    expect(parseModelJson('{"a":1} Hope this helps! {"b":2}')).toEqual({ a: 1 });
  });
  it('tolerates trailing commas', () => {
    expect(parseModelJson('{"a":[1,2,],}')).toEqual({ a: [1, 2] });
  });
  it('does not get confused by braces inside strings', () => {
    expect(parseModelJson('{"name":"Café {central}","x":"a \\" }"}')).toEqual({ name: 'Café {central}', x: 'a " }' });
  });
  it('throws empty for blank output', () => {
    expect(() => parseModelJson('   ')).toThrow(expect.objectContaining({ kind: 'empty' }));
  });
  it('throws parse for truncated JSON', () => {
    expect(() => parseModelJson('{"days":[{"title":"Day 1"')).toThrow(expect.objectContaining({ kind: 'parse' }));
  });
  it('throws parse when there is no JSON at all', () => {
    expect(() => parseModelJson('I cannot help with that.')).toThrow(expect.objectContaining({ kind: 'parse' }));
  });
});

describe('parsePartialJson', () => {
  it('recovers the complete prefix of an unfinished stream', () => {
    // The half-written second stop becomes {}; normalizeItinerary drops it in partial mode.
    const partial = '{"title":"Lisbon","days":[{"title":"Day 1","stops":[{"name":"Café"},{"name":"Mira';
    expect(parsePartialJson(partial)).toEqual({ title: 'Lisbon', days: [{ title: 'Day 1', stops: [{ name: 'Café' }, {}] }] });
  });
  it('returns null before any JSON has arrived', () => {
    expect(parsePartialJson('Sure, here')).toBeNull();
  });
  it('handles a stream cut right after an opening bracket', () => {
    expect(parsePartialJson('```json\n{"days":[')).toEqual({ days: [] });
  });
});
