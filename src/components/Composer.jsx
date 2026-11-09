import { ArrowRight, LoaderCircle, X } from 'lucide-react';
import { useLayoutEffect } from 'react';

export const MAX_PROMPT = 2000;

const EXAMPLES = [
  { label: '4 days in Lisbon', text: '4 days in Lisbon in May. We love seafood, viewpoints and slow mornings; no museums please. Mid-range budget.' },
  { label: 'Tokyo with kids', text: 'A long weekend in Tokyo with two kids (6 and 9). Budget around $200/day, nothing too far apart, at least one big park.' },
  { label: 'Iceland road trip', text: '7-day Ring Road road trip around Iceland in June: hiking, hot springs, waterfalls. We have a rental car.' },
  { label: 'Vegetarian Mexico City', text: '3 days in Mexico City for a vegetarian who loves art, architecture and markets.' },
];

export function Composer({ value, onChange, onSubmit, onCancel, loading, textareaRef }) {
  const trimmed = value.trim();
  const tooLong = value.length > MAX_PROMPT;
  const canSubmit = trimmed.length >= 3 && !tooLong && !loading;

  // Grow the textarea with its content.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [value, textareaRef]);

  const submit = (e) => {
    e.preventDefault();
    if (canSubmit) onSubmit(trimmed);
  };

  return (
    <form className="composer" onSubmit={submit} aria-busy={loading}>
      <label htmlFor="trip-prompt" className="sr-only">
        Describe your trip
      </label>
      <div className={`composer__box ${loading ? 'is-loading' : ''}`}>
        <textarea
          id="trip-prompt"
          ref={textareaRef}
          value={value}
          rows={3}
          readOnly={loading}
          placeholder="Where are you going, for how long, and what do you love? e.g. “5 relaxed days in Kyoto in autumn, temples and great food”"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
          }}
          aria-describedby="prompt-help"
          aria-invalid={tooLong}
        />
        <div className="composer__footer">
          <span id="prompt-help" className={`composer__count ${tooLong ? 'is-error' : ''}`}>
            {tooLong ? `${value.length - MAX_PROMPT} characters over the limit` : (
              <>
                <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to plan
              </>
            )}
          </span>
          {loading ? (
            <button type="button" className="btn btn--secondary" onClick={onCancel}>
              <X size={16} aria-hidden="true" /> Cancel
            </button>
          ) : (
            <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
              Plan my trip <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        {loading && (
          <div className="composer__busy" aria-hidden="true">
            <LoaderCircle size={14} className="spin" />
          </div>
        )}
      </div>

      {!loading && (
        <div className="chips" aria-label="Example trips">
          <span className="chips__label">Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              className="chip"
              onClick={() => {
                onChange(ex.text);
                textareaRef.current?.focus();
              }}
            >
              {ex.label}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
