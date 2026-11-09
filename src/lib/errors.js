/**
 * Every failure the UI can show is an ItineraryError with a `kind`.
 * The kind decides the copy, the icon, and whether we auto-repair.
 */
export class ItineraryError extends Error {
  constructor(kind, message, extra = {}) {
    super(message);
    this.name = 'ItineraryError';
    this.kind = kind;
    Object.assign(this, extra);
  }
}

/** Kinds that mean "the model answered, but badly", worth one automatic repair attempt. */
export const REPAIRABLE_KINDS = new Set(['parse', 'shape', 'empty']);

/** Kinds where pressing "Try again" with the same input has a reasonable chance of working. */
export const RETRYABLE_KINDS = new Set(['parse', 'shape', 'empty', 'timeout', 'network', 'upstream', 'rate_limit', 'unknown']);

export const ERROR_COPY = {
  network: {
    title: "Couldn't reach the planner",
    hint: 'Check your connection. If you are running locally, make sure the API server is up (npm start).',
  },
  timeout: {
    title: 'The AI is taking too long',
    hint: 'The provider stopped responding. It is usually temporary, so try again in a moment.',
  },
  upstream: {
    title: 'The AI provider had a problem',
    hint: 'This is on the provider’s side. Trying again usually works.',
  },
  rate_limit: {
    title: 'Too many requests',
    hint: 'The free tier is rate-limited. Wait 20–30 seconds, then try again.',
  },
  auth: {
    title: 'The API key was rejected',
    hint: 'Check LLM_API_KEY in your .env file and restart the server.',
  },
  bad_request: {
    title: 'That request didn’t go through',
    hint: 'Try rephrasing your trip description.',
  },
  parse: {
    title: 'The AI’s answer came back garbled',
    hint: 'We asked it to fix its answer, but it still wasn’t valid. Trying again usually works.',
  },
  shape: {
    title: 'The AI answered in the wrong format',
    hint: 'It replied without a usable day-by-day plan. Try again, or add more detail to your request.',
  },
  empty: {
    title: 'The AI returned an empty plan',
    hint: 'Try again, or be more specific about where and how long.',
  },
  not_a_trip: {
    title: 'That doesn’t look like a trip yet',
    hint: 'Mention a destination and, ideally, how many days and what you enjoy.',
  },
  unknown: {
    title: 'Something went wrong',
    hint: 'Try again. If it keeps happening, reload the page.',
  },
};

export function copyFor(error) {
  return ERROR_COPY[error?.kind] ?? ERROR_COPY.unknown;
}
