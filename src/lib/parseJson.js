import { ItineraryError } from './errors.js';

/**
 * Models wrap JSON in prose, ```json fences, or <think> blocks.
 * Return the text starting at the first `{` or `[`, with that wrapping removed.
 */
export function extractJsonText(raw) {
  if (typeof raw !== 'string') return '';
  let text = raw.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  const fence = text.match(/```(?:json|JSON)?\s*([\s\S]*?)(```|$)/);
  if (fence) text = fence[1].trim();
  const start = text.search(/[{[]/);
  return start === -1 ? text : text.slice(start);
}

/**
 * Single pass over JSON text, tracking strings and bracket depth.
 * - `end`: index just past the first complete top-level value (-1 if unfinished).
 * - `cuts`: places where the text could be cut and closed into valid JSON,
 *   each with the closing brackets needed at that point.
 */
function scan(text) {
  const stack = [];
  const cuts = [];
  let inString = false;
  let escaped = false;
  const closers = () => stack.slice().reverse().join('');

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') {
      stack.push(ch === '{' ? '}' : ']');
      cuts.push({ index: i + 1, closers: closers() });
    } else if (ch === '}' || ch === ']') {
      stack.pop();
      if (stack.length === 0) return { end: i + 1, cuts };
      cuts.push({ index: i + 1, closers: closers() });
    } else if (ch === ',') {
      cuts.push({ index: i, closers: closers() }); // cut *before* the comma
    }
  }
  return { end: -1, cuts };
}

/** Parse a complete model reply. Throws ItineraryError('empty' | 'parse'). */
export function parseModelJson(raw) {
  const text = extractJsonText(raw);
  if (!text.trim()) throw new ItineraryError('empty', 'The AI returned an empty response.', { raw });
  if (!/^[{[]/.test(text)) {
    throw new ItineraryError('parse', 'The response contained no JSON object.', { raw });
  }

  const { end } = scan(text);
  const candidate = end === -1 ? text : text.slice(0, end); // ignore trailing chatter
  try {
    return JSON.parse(candidate);
  } catch (err) {
    // Common, safe-to-fix slip: trailing commas before } or ].
    try {
      return JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1'));
    } catch {
      /* fall through */
    }
    const reason =
      end === -1
        ? 'The JSON was cut off before it finished.'
        : `The response was not valid JSON (${err.message}).`;
    throw new ItineraryError('parse', reason, { raw });
  }
}

/**
 * Best-effort parse of an *unfinished* stream, used only for the live preview.
 * Tries the latest safe cut points first; returns null if nothing usable yet.
 */
export function parsePartialJson(raw, maxAttempts = 40) {
  const text = extractJsonText(raw);
  if (!/^[{[]/.test(text)) return null;
  const { end, cuts } = scan(text);
  if (end !== -1) {
    try {
      return JSON.parse(text.slice(0, end));
    } catch {
      /* keep trying cuts */
    }
  }
  for (let i = cuts.length - 1, tries = 0; i >= 0 && tries < maxAttempts; i--, tries++) {
    const { index, closers } = cuts[i];
    try {
      return JSON.parse(text.slice(0, index) + closers);
    } catch {
      /* try an earlier cut */
    }
  }
  return null;
}
