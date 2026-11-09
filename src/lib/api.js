import { ItineraryError } from './errors.js';

const STATUS_KINDS = { 400: 'bad_request', 429: 'rate_limit', 504: 'timeout' };

/**
 * POSTs to the backend and reads its NDJSON stream.
 * Calls onDelta(text) for every chunk and resolves with the full text.
 * Throws ItineraryError for every failure mode, or a DOMException('AbortError') when cancelled.
 *
 * idleTimeoutMs: give up if no bytes arrive for this long (covers "connected but stalled").
 */
export async function streamItinerary({ body, signal, onDelta, idleTimeoutMs = 30_000 }) {
  // Our own controller so the idle timer can abort, chained to the caller's signal.
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', forwardAbort, { once: true });

  let idleTimer;
  let timedOut = false;
  const armIdleTimer = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, idleTimeoutMs);
  };

  try {
    armIdleTimer();
    let res;
    try {
      res = await fetch('/api/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      throw translateFetchError(err, timedOut, signal, idleTimeoutMs);
    }

    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      const code = payload?.error?.code;
      const kind = code || STATUS_KINDS[res.status] || (res.status >= 500 ? 'upstream' : 'unknown');
      throw new ItineraryError(kind, payload?.error?.message || `Request failed with status ${res.status}.`, {
        status: res.status,
      });
    }
    if (!res.body) throw new ItineraryError('network', 'The server sent no response body.');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    let finished = false;

    const handleLine = (line) => {
      if (!line.trim()) return;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        return; // a corrupt frame is not fatal; the final parse will judge the content
      }
      if (event.type === 'delta' && typeof event.text === 'string') {
        full += event.text;
        onDelta?.(event.text, full);
      } else if (event.type === 'error') {
        throw new ItineraryError(event.code || 'upstream', event.message || 'The AI provider failed mid-response.');
      } else if (event.type === 'done') {
        finished = true;
      }
    };

    while (true) {
      let chunk;
      try {
        chunk = await reader.read();
      } catch (err) {
        throw translateFetchError(err, timedOut, signal, idleTimeoutMs);
      }
      if (chunk.done) break;
      armIdleTimer();
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      lines.forEach(handleLine);
    }
    handleLine(buffer);

    if (!finished) {
      throw new ItineraryError('network', 'The connection dropped before the AI finished answering.');
    }
    return full;
  } finally {
    clearTimeout(idleTimer);
    signal?.removeEventListener('abort', forwardAbort);
    controller.abort(); // release the connection if we bailed out early
  }
}

function translateFetchError(err, timedOut, outerSignal, idleTimeoutMs) {
  if (err instanceof ItineraryError) return err;
  if (timedOut) return new ItineraryError('timeout', `No response from the AI for ${Math.round(idleTimeoutMs / 1000)} seconds.`);
  if (outerSignal?.aborted) return new DOMException('Cancelled', 'AbortError');
  return new ItineraryError('network', 'Network request failed.');
}

export async function fetchHealth(signal) {
  const res = await fetch('/api/health', { signal });
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  return res.json();
}
