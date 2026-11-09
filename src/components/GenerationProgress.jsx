import { Check, Hourglass, LoaderCircle, WandSparkles } from 'lucide-react';

const STEPS = [
  { phase: 'connecting', label: 'Contacting the AI' },
  { phase: 'streaming', label: 'Drafting your itinerary' },
  { phase: 'validating', label: 'Checking the plan' },
];

function StepList({ phase }) {
  const current = STEPS.findIndex((s) => s.phase === phase);
  return (
    <ol className="steps">
      {STEPS.map((step, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'todo';
        return (
          <li key={step.phase} className={`steps__item is-${state}`}>
            <span className="steps__icon">
              {state === 'done' ? <Check size={12} /> : state === 'active' ? <LoaderCircle size={12} className="spin" /> : null}
            </span>
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}

function SkeletonStop({ i }) {
  return (
    <li className="preview-stop preview-stop--skeleton" style={{ '--i': i }}>
      <span className="skeleton skeleton--time" />
      <span className="skeleton skeleton--line" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
    </li>
  );
}

/** Live view of the itinerary while it streams in, built from partially-parsed JSON. */
export function GenerationProgress({ phase, preview, slow, repairing, received }) {
  const days = preview?.days ?? [];
  return (
    <section className="progress" aria-live="polite" aria-busy="true">
      <div className="progress__top">
        <StepList phase={phase} />
        {received > 0 && <span className="progress__bytes">{(received / 1024).toFixed(1)} KB received</span>}
      </div>

      {repairing && (
        <p className="notice notice--info">
          <WandSparkles size={16} aria-hidden="true" />
          The first answer was malformed, so we’re asking the AI to fix it…
        </p>
      )}
      {slow && !repairing && phase === 'connecting' && (
        <p className="notice">
          <Hourglass size={16} aria-hidden="true" />
          Taking a little longer than usual. Long trips take more time to write.
        </p>
      )}

      <div className="preview">
        {preview?.title ? (
          <div className="preview__head fade-in">
            {preview.destination && <p className="eyebrow">{preview.destination}</p>}
            <h2 className="preview__title">{preview.title}</h2>
          </div>
        ) : (
          <div className="preview__head">
            <span className="skeleton skeleton--eyebrow" />
            <span className="skeleton skeleton--title" />
          </div>
        )}

        <div className="preview__days">
          {days.map((day, d) => (
            <div key={d} className="preview-day fade-in">
              <p className="preview-day__label">
                Day {d + 1}
                {day.title && <span> · {day.title}</span>}
              </p>
              <ul>
                {day.stops.map((stop, s) => (
                  <li key={s} className="preview-stop fade-in">
                    <span className="preview-stop__time">{stop.time || '··:··'}</span>
                    <span>{stop.name}</span>
                  </li>
                ))}
                {d === days.length - 1 && <SkeletonStop i={day.stops.length} />}
              </ul>
            </div>
          ))}
          {days.length === 0 && (
            <div className="preview-day">
              <span className="skeleton skeleton--label" />
              <ul>
                {[0, 1, 2, 3].map((i) => (
                  <SkeletonStop key={i} i={i} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
