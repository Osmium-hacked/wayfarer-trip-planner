import { CalendarDays, Trash2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { formatRelativeTime } from '../lib/format.js';

/** Side sheet built on <dialog>: native focus trapping, Esc to close, and a backdrop for free. */
export function SavedTripsDrawer({ open, trips, currentId, onClose, onOpen, onDelete }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-labelledby="drawer-title"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()} // click on backdrop
    >
      <div className="drawer__panel">
        <header className="drawer__head">
          <h2 id="drawer-title">My trips</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <p className="drawer__hint">Trips save automatically in this browser.</p>
        {trips.length === 0 ? (
          <div className="drawer__empty">
            <CalendarDays size={28} aria-hidden="true" />
            <p>No saved trips yet. Plan one and it will show up here.</p>
          </div>
        ) : (
          <ul className="trip-list">
            {trips.map((t) => (
              <TripListItem key={t.id} trip={t} current={t.id === currentId} onOpen={onOpen} onDelete={onDelete} />
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}

export function TripListItem({ trip, current, onOpen, onDelete }) {
  const stops = trip.days.reduce((n, d) => n + d.stops.length, 0);
  return (
    <li className={`trip-item ${current ? 'is-current' : ''}`}>
      <button type="button" className="trip-item__main" onClick={() => onOpen(trip)}>
        <span className="trip-item__title">{trip.title}</span>
        <span className="trip-item__meta">
          {trip.destination && `${trip.destination} · `}
          {trip.days.length} {trip.days.length === 1 ? 'day' : 'days'} · {stops} stops
          {trip.updatedAt ? ` · ${formatRelativeTime(trip.updatedAt)}` : ''}
        </span>
        {current && <span className="trip-item__tag">Open</span>}
      </button>
      {onDelete && (
        <button type="button" className="icon-btn icon-btn--sm" aria-label={`Delete ${trip.title}`} onClick={() => onDelete(trip)}>
          <Trash2 size={15} />
        </button>
      )}
    </li>
  );
}
