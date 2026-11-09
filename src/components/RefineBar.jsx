import { ArrowUp, LoaderCircle, WandSparkles, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { ErrorPanel } from './ErrorPanel.jsx';

const SUGGESTIONS = ['Make day 2 more relaxed', 'Add a great dinner spot each evening', 'Swap one museum for something outdoors', 'Make it cheaper'];

/**
 * Follow-up prompts that edit the current itinerary instead of regenerating it.
 * A failed refinement never touches the trip; the error shows inline here.
 */
export function RefineBar({ refine, onSubmit, onRetry }) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [lastSubmitted, setLastSubmitted] = useState('');
  const inputRef = useRef(null);
  const loading = refine.isLoading;

  const submit = async (text) => {
    const instruction = text.trim();
    if (!instruction || loading) return;
    setLastSubmitted(instruction);
    const ok = await onSubmit(instruction);
    if (ok) setValue('');
  };

  return (
    <div className="refine" role="region" aria-label="Refine itinerary">
      <div className="refine__inner">
        {refine.status === 'error' && (
          <ErrorPanel
            compact
            error={refine.error}
            onRetry={() => onRetry(lastSubmitted)}
            onDismiss={refine.reset}
          />
        )}
        {focused && !value && !loading && (
          <div className="chips chips--tight" aria-label="Suggestions">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="chip chip--sm"
                // keep focus in the input so the chips don't disappear before the click lands
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setValue(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          className={`refine__form ${loading ? 'is-loading' : ''}`}
          onSubmit={(e) => {
            e.preventDefault();
            submit(value);
          }}
        >
          <span className="refine__icon" aria-hidden="true">
            {loading ? <LoaderCircle size={18} className="spin" /> : <WandSparkles size={18} />}
          </span>
          {loading ? (
            <span className="refine__status" aria-live="polite">
              {refine.repairing
                ? 'Fixing a malformed answer…'
                : refine.phase === 'validating'
                  ? 'Checking the changes…'
                  : refine.slow
                    ? 'Still working, this one is taking a while…'
                    : `Updating: “${lastSubmitted}”`}
            </span>
          ) : (
            <input
              ref={inputRef}
              className="refine__input"
              value={value}
              maxLength={500}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Ask for changes, e.g. “swap day 1 and day 2”"
              aria-label="Describe a change to the itinerary"
            />
          )}
          {loading ? (
            <button type="button" className="btn btn--secondary btn--sm" onClick={refine.cancel}>
              <X size={15} aria-hidden="true" /> Cancel
            </button>
          ) : (
            <button type="submit" className="icon-btn icon-btn--primary" aria-label="Apply change" disabled={!value.trim()}>
              <ArrowUp size={18} />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
