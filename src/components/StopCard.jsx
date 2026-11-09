import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, ChevronDown, ExternalLink, GripVertical, Lightbulb, MapPin, Trash2 } from 'lucide-react';
import { memo } from 'react';
import { formatDuration, formatMoney, mapsUrl } from '../lib/format.js';
import { CATEGORY_META, CategoryIcon } from './icons.jsx';

/** Move focus to the previous/next stop header (roving arrow-key navigation). */
function focusSibling(current, delta) {
  const all = Array.from(document.querySelectorAll('[data-stop-focus]'));
  all[all.indexOf(current) + delta]?.focus();
}

export const StopCard = memo(function StopCard({
  stop,
  dayIndex,
  days,
  currency,
  destination,
  expanded,
  isFirst,
  isLast,
  locked,
  onToggle,
  onMove,
  onMoveToDay,
  onRemove,
  // supplied by SortableStop
  nodeRef,
  style,
  handleProps,
  dragging,
  overlay,
}) {
  const bodyId = `stop-body-${stop.id}`;
  const meta = [formatDuration(stop.durationMinutes), formatMoney(stop.cost, currency)].filter(Boolean);

  const onKeyDown = (e) => {
    if (locked) return;
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      onMove(stop.id, e.key === 'ArrowUp' ? -1 : 1);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      focusSibling(e.currentTarget, e.key === 'ArrowUp' ? -1 : 1);
    } else if (e.key === 'Delete') {
      e.preventDefault();
      onRemove(stop.id);
    }
  };

  return (
    <li
      ref={nodeRef}
      style={style}
      className={`stop ${expanded ? 'is-expanded' : ''} ${dragging ? 'is-dragging' : ''} ${overlay ? 'is-overlay' : ''}`}
      data-category={stop.category}
    >
      <div className="stop__rail" aria-hidden="true">
        <span className="stop__time">{stop.time}</span>
        <span className="stop__dot" />
      </div>

      <div className="stop__card">
        <div className="stop__head">
          <button
            type="button"
            className="stop__handle"
            aria-label={`Drag to reorder ${stop.name}`}
            disabled={locked}
            {...handleProps}
          >
            <GripVertical size={16} />
          </button>
          <button
            type="button"
            className="stop__toggle"
            data-stop-focus={stop.id}
            aria-expanded={expanded}
            aria-controls={bodyId}
            onClick={() => onToggle(stop.id)}
            onKeyDown={onKeyDown}
          >
            <span className="stop__icon" title={CATEGORY_META[stop.category]?.label}>
              <CategoryIcon category={stop.category} />
            </span>
            <span className="stop__main">
              <span className="stop__name">{stop.name}</span>
              <span className="stop__meta">
                {stop.time && <span className="stop__time-inline">{stop.time}</span>}
                {meta.map((m) => (
                  <span key={m} className="stop__meta-item">
                    {m}
                  </span>
                ))}
              </span>
            </span>
            <ChevronDown size={18} className="stop__chev" aria-hidden="true" />
          </button>
        </div>

        <div className="stop__body" id={bodyId} inert={!expanded}>
          <div className="stop__body-inner">
            {stop.description && <p className="stop__desc">{stop.description}</p>}
            {stop.tip && (
              <p className="stop__tip">
                <Lightbulb size={15} aria-hidden="true" />
                <span>{stop.tip}</span>
              </p>
            )}
            <a className="stop__map" href={mapsUrl(stop, destination)} target="_blank" rel="noreferrer">
              <MapPin size={14} aria-hidden="true" />
              {stop.location || 'Find on map'}
              <ExternalLink size={12} aria-hidden="true" />
            </a>

            <div className="stop__actions">
              <div className="btn-group" role="group" aria-label="Reorder">
                <button type="button" className="icon-btn icon-btn--sm" disabled={locked || isFirst} onClick={() => onMove(stop.id, -1)} aria-label="Move up" title="Move up (Alt+↑)">
                  <ArrowUp size={15} />
                </button>
                <button type="button" className="icon-btn icon-btn--sm" disabled={locked || isLast} onClick={() => onMove(stop.id, 1)} aria-label="Move down" title="Move down (Alt+↓)">
                  <ArrowDown size={15} />
                </button>
              </div>
              {days.length > 1 && (
                <label className="select-inline">
                  <span className="sr-only">Move to day</span>
                  <select
                    value=""
                    disabled={locked}
                    onChange={(e) => e.target.value && onMoveToDay(stop.id, e.target.value)}
                  >
                    <option value="">Move to day…</option>
                    {days.map((d, i) =>
                      i === dayIndex ? null : (
                        <option key={d.id} value={d.id}>
                          Day {i + 1}
                          {d.title ? ` · ${d.title}` : ''}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              )}
              <button type="button" className="btn btn--danger-ghost btn--sm" disabled={locked} onClick={() => onRemove(stop.id)}>
                <Trash2 size={15} aria-hidden="true" /> Remove
              </button>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
});

export function SortableStop(props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props.stop.id,
    disabled: props.locked,
  });
  return (
    <StopCard
      {...props}
      nodeRef={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      dragging={isDragging}
      handleProps={{ ref: setActivatorNodeRef, ...attributes, ...listeners }}
    />
  );
}
