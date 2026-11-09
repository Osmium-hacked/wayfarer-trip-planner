import { FileWarning, Hourglass, KeyRound, MapPinned, Pencil, RotateCcw, Timer, TriangleAlert, WifiOff, X } from 'lucide-react';
import { copyFor, RETRYABLE_KINDS } from '../lib/errors.js';

const ICONS = {
  network: WifiOff,
  timeout: Hourglass,
  rate_limit: Timer,
  auth: KeyRound,
  parse: FileWarning,
  shape: FileWarning,
  empty: FileWarning,
  not_a_trip: MapPinned,
};

/** One component for every failure. `compact` is the inline version used under the refine bar. */
export function ErrorPanel({ error, onRetry, onEdit, onDismiss, compact = false }) {
  const copy = copyFor(error);
  const Icon = ICONS[error.kind] ?? TriangleAlert;
  const retryable = RETRYABLE_KINDS.has(error.kind);
  const soft = error.kind === 'not_a_trip';
  // For "not a trip" the model's own message is the most helpful thing to show.
  const message = soft ? error.message : copy.hint;

  return (
    <div className={`error-panel ${compact ? 'error-panel--compact' : ''} ${soft ? 'error-panel--soft' : ''}`} role="alert">
      <span className="error-panel__icon">
        <Icon size={compact ? 16 : 20} aria-hidden="true" />
      </span>
      <div className="error-panel__body">
        <p className="error-panel__title">{copy.title}</p>
        <p className="error-panel__text">{message}</p>
        {!compact && (error.message || error.raw) && !soft && (
          <details className="error-panel__details">
            <summary>Technical details</summary>
            <p>
              <code>{error.kind}</code> {error.message}
            </p>
            {error.raw && (
              <>
                <p className="muted">Raw model output (first 1,500 characters):</p>
                <pre>{error.raw.slice(0, 1500) || '(empty)'}</pre>
              </>
            )}
          </details>
        )}
        <div className="error-panel__actions">
          {retryable && onRetry && (
            <button type="button" className={`btn ${compact ? 'btn--sm btn--secondary' : 'btn--primary'}`} onClick={onRetry}>
              <RotateCcw size={15} aria-hidden="true" /> Try again
            </button>
          )}
          {onEdit && (
            <button type="button" className={`btn btn--ghost ${compact ? 'btn--sm' : ''}`} onClick={onEdit}>
              <Pencil size={15} aria-hidden="true" /> Edit request
            </button>
          )}
        </div>
      </div>
      {onDismiss && (
        <button type="button" className="icon-btn icon-btn--sm error-panel__close" aria-label="Dismiss error" onClick={onDismiss}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}
