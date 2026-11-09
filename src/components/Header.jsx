import { FlaskConical, FolderOpen, Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Logo } from './icons.jsx';

const THEME_ICON = { system: Monitor, light: Sun, dark: Moon };
const THEME_LABEL = { system: 'Theme: system', light: 'Theme: light', dark: 'Theme: dark' };

export const SIMULATION_LABELS = {
  '': 'Off: real responses',
  'malformed-once': 'Malformed JSON, auto-repair succeeds',
  malformed: 'Malformed JSON on every attempt',
  'wrong-shape': 'Valid JSON, wrong shape',
  empty: 'Empty response',
  partial: 'Messy but salvageable data',
  'not-a-trip': 'Model says "not a trip"',
  slow: 'Slow (12 s) but succeeds',
  stall: 'Stalls → idle timeout (30 s)',
  error: 'Provider outage (503)',
  'rate-limit': 'Rate limited (429)',
};

function ModeBadge({ health }) {
  if (!health) return null;
  if (!health.ok) {
    return (
      <span className="badge badge--danger" title="The API server isn't reachable. Run npm start.">
        <span className="badge__dot" /> <span className="badge__text">API offline</span>
      </span>
    );
  }
  if (health.mode === 'demo') {
    return (
      <span className="badge badge--warn" title="No LLM_API_KEY set: itineraries come from a built-in sample generator.">
        <span className="badge__dot" /> <span className="badge__text">Demo mode</span>
      </span>
    );
  }
  return (
    <span className="badge" title={`Model: ${health.model}`}>
      <span className="badge__dot badge__dot--live" /> <span className="badge__text">{health.provider}</span>
    </span>
  );
}

function SimulateMenu({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div className="popover-anchor" ref={ref}>
      <button
        type="button"
        className={`icon-btn ${value ? 'icon-btn--active' : ''}`}
        aria-label="Simulate AI failures"
        aria-expanded={open}
        title="Simulate AI failures"
        onClick={() => setOpen((o) => !o)}
      >
        <FlaskConical size={18} />
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Failure simulation">
          <p className="popover__title">Simulate a bad AI response</p>
          <p className="popover__hint">Applies to the next generations and refinements, so you can see how the app copes.</p>
          <div className="radio-list" role="radiogroup">
            {['', ...options].map((opt) => (
              <label key={opt || 'off'} className="radio-row">
                <input
                  type="radio"
                  name="simulate"
                  checked={value === opt}
                  onChange={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                />
                <span>{SIMULATION_LABELS[opt] ?? opt}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Header({ health, theme, onCycleTheme, tripCount, onOpenTrips, onHome, simulate, onSimulateChange }) {
  const ThemeIcon = THEME_ICON[theme];
  const simulations = health?.simulations ?? [];
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <button type="button" className="brand" onClick={onHome} aria-label="Wayfarer home">
          <Logo />
          <span className="brand__name">Wayfarer</span>
        </button>
        <ModeBadge health={health} />
        {simulate && (
          <button type="button" className="badge badge--sim" onClick={() => onSimulateChange('')} title="Click to turn off">
            Simulating: {SIMULATION_LABELS[simulate]} ✕
          </button>
        )}
        <div className="app-header__actions">
          {simulations.length > 0 && <SimulateMenu options={simulations} value={simulate} onChange={onSimulateChange} />}
          <button type="button" className="btn btn--ghost btn--sm" onClick={onOpenTrips}>
            <FolderOpen size={16} aria-hidden="true" />
            <span className="hide-sm">My trips</span>
            {tripCount > 0 && <span className="count">{tripCount}</span>}
          </button>
          <button type="button" className="icon-btn" onClick={onCycleTheme} aria-label={THEME_LABEL[theme]} title={THEME_LABEL[theme]}>
            <ThemeIcon size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
