import { useCallback, useEffect, useRef, useState } from 'react';
import { streamItinerary } from '../lib/api.js';
import { ItineraryError, REPAIRABLE_KINDS } from '../lib/errors.js';
import { normalizeItinerary } from '../lib/normalize.js';
import { parseModelJson, parsePartialJson } from '../lib/parseJson.js';

const SLOW_AFTER_MS = 8_000;
const MAX_REPAIRS = 1;
const PREVIEW_INTERVAL_MS = 120;

const IDLE = { status: 'idle', phase: null, preview: null, error: null, slow: false, repairing: false, received: 0 };

function previewFrom(raw) {
  const partial = parsePartialJson(raw);
  if (!partial) return null;
  try {
    return normalizeItinerary(partial, { partial: true }).itinerary;
  } catch {
    return null;
  }
}

/**
 * Runs one generation (create or refine) end to end:
 * stream → live preview → parse → validate → (one automatic repair) → result.
 *
 * Race safety: every run gets an id. Starting a new run (or cancelling) bumps the id and
 * aborts the old request, and every state update checks the id first, so a slow, stale
 * response can never overwrite a newer one.
 *
 * `run` resolves to { itinerary, warnings } on success, or null if it failed or was superseded.
 */
export function useItineraryGenerator() {
  const [state, setState] = useState(IDLE);
  const runIdRef = useRef(0);
  const abortRef = useRef(null);

  const cancel = useCallback(() => {
    runIdRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    setState(IDLE);
  }, []);

  const reset = useCallback(() => setState((s) => (s.status === 'loading' ? s : IDLE)), []);

  // Abort in-flight work if the component using this hook unmounts.
  useEffect(
    () => () => {
      runIdRef.current++;
      abortRef.current?.abort();
    },
    [],
  );

  const run = useCallback(async ({ prompt, current = null, originalPrompt = '', simulate = '' }) => {
    const runId = ++runIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const isLatest = () => runId === runIdRef.current;
    const update = (patch) => isLatest() && setState((s) => ({ ...s, ...patch }));

    setState({ ...IDLE, status: 'loading', phase: 'connecting' });
    const slowTimer = setTimeout(() => update({ slow: true }), SLOW_AFTER_MS);

    let repair = null;
    try {
      for (let attempt = 0; attempt <= MAX_REPAIRS; attempt++) {
        let lastPreviewAt = 0;
        // "-once" simulations only break the first attempt, to demo a successful repair.
        const sim = attempt > 0 && simulate.endsWith('-once') ? '' : simulate;

        const raw = await streamItinerary({
          body: { prompt, current, originalPrompt, repair, simulate: sim || undefined },
          signal: controller.signal,
          onDelta: (_chunk, full) => {
            if (!isLatest()) return;
            const now = performance.now();
            if (now - lastPreviewAt < PREVIEW_INTERVAL_MS) return; // throttle re-parsing
            lastPreviewAt = now;
            const preview = current ? null : previewFrom(full);
            setState((s) => ({ ...s, phase: 'streaming', received: full.length, preview: preview ?? s.preview }));
          },
        });
        if (!isLatest()) return null;
        update({ phase: 'validating', received: raw.length });

        try {
          const result = normalizeItinerary(parseModelJson(raw));
          setState(IDLE);
          return result;
        } catch (err) {
          const canRepair = err instanceof ItineraryError && REPAIRABLE_KINDS.has(err.kind) && attempt < MAX_REPAIRS;
          if (!canRepair) throw Object.assign(err, { raw });
          repair = { raw: raw.slice(0, 8000), error: err.message };
          update({ phase: 'connecting', repairing: true, preview: null, received: 0 });
        }
      }
      return null; // unreachable, loop always returns or throws
    } catch (err) {
      if (!isLatest() || err?.name === 'AbortError') return null;
      const error =
        err instanceof ItineraryError ? err : new ItineraryError('unknown', err?.message || 'Unexpected error.');
      setState({ ...IDLE, status: 'error', error });
      return null;
    } finally {
      clearTimeout(slowTimer);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, []);

  return { ...state, isLoading: state.status === 'loading', run, cancel, reset };
}
