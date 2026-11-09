import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { formatDuration } from '../lib/format.js';
import { AddStopForm } from './AddStopForm.jsx';
import { SortableStop, StopCard } from './StopCard.jsx';

const columnsOf = (trip) => Object.fromEntries(trip.days.map((d) => [d.id, d.stops.map((s) => s.id)]));

function findContainer(id, columns) {
  if (columns[id]) return id; // hovering an (empty) day itself
  return Object.keys(columns).find((dayId) => columns[dayId].includes(id));
}

function DaySection({ day, index, stopIds, stopsById, shared, onAddStop, onRemoveDay, canRemoveDay }) {
  const { setNodeRef, isOver } = useDroppable({ id: day.id });
  const stops = stopIds.map((id) => stopsById.get(id)).filter(Boolean);
  const totalMinutes = stops.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const headingId = `day-heading-${day.id}`;

  return (
    <section className="day" id={`day-${day.id}`} aria-labelledby={headingId} style={{ '--i': index }}>
      <header className="day__head">
        <span className="day__badge">Day {index + 1}</span>
        <h3 className="day__title" id={headingId}>
          {day.title || `Day ${index + 1}`}
        </h3>
        <span className="day__meta">
          {stops.length} {stops.length === 1 ? 'stop' : 'stops'}
          {totalMinutes > 0 && ` · ${formatDuration(totalMinutes)}`}
        </span>
        {canRemoveDay && (
          <button
            type="button"
            className="icon-btn icon-btn--sm day__remove"
            aria-label={`Remove day ${index + 1}`}
            title="Remove this day"
            disabled={shared.locked}
            onClick={() => onRemoveDay(day.id, index)}
          >
            <Trash2 size={15} />
          </button>
        )}
      </header>

      <SortableContext id={day.id} items={stopIds} strategy={verticalListSortingStrategy}>
        <ol ref={setNodeRef} className={`day__stops ${isOver ? 'is-over' : ''} ${stops.length === 0 ? 'is-empty' : ''}`}>
          {stops.map((stop, i) => (
            <SortableStop
              key={stop.id}
              {...shared}
              stop={stop}
              dayIndex={index}
              expanded={shared.expanded.has(stop.id)}
              isFirst={index === 0 && i === 0}
              isLast={index === shared.days.length - 1 && i === stops.length - 1}
            />
          ))}
          {stops.length === 0 && (
            <li className="day__empty">Nothing planned yet. Drag a stop here, add your own, or ask the AI to fill this day.</li>
          )}
        </ol>
      </SortableContext>

      <AddStopForm dayId={day.id} onAdd={onAddStop} locked={shared.locked} />
    </section>
  );
}

/**
 * All days share one DndContext so stops can be dragged between days.
 * While dragging we keep a local copy of the order (columns) and commit a single
 * `reorder` action on drop, so one drag = one undo step.
 */
export function DayBoard({ trip, expanded, locked, onToggle, onMove, onMoveToDay, onRemove, onAddStop, onRemoveDay, onReorder }) {
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  const setDragState = (next) => {
    dragRef.current = typeof next === 'function' ? next(dragRef.current) : next;
    setDrag(dragRef.current);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const stopsById = useMemo(() => {
    const map = new Map();
    trip.days.forEach((d) => d.stops.forEach((s) => map.set(s.id, s)));
    return map;
  }, [trip]);

  const columns = drag?.columns ?? columnsOf(trip);
  const activeStop = drag ? stopsById.get(drag.activeId) : null;

  const shared = {
    days: trip.days,
    currency: trip.currency,
    destination: trip.destination,
    expanded,
    locked,
    onToggle,
    onMove,
    onMoveToDay,
    onRemove,
  };

  const handleDragOver = ({ active, over }) => {
    if (!over) return;
    setDragState((d) => {
      if (!d) return d;
      const from = findContainer(active.id, d.columns);
      const to = findContainer(over.id, d.columns);
      if (!from || !to || from === to) return d;
      const target = d.columns[to].slice();
      const overIndex = target.indexOf(over.id);
      const translated = active.rect.current.translated;
      const below = translated && over.rect ? translated.top > over.rect.top + over.rect.height / 2 : false;
      target.splice(overIndex === -1 ? target.length : overIndex + (below ? 1 : 0), 0, active.id);
      return { ...d, columns: { ...d.columns, [from]: d.columns[from].filter((id) => id !== active.id), [to]: target } };
    });
  };

  const handleDragEnd = ({ active, over }) => {
    const d = dragRef.current;
    setDragState(null);
    if (!d || !over) return;
    let cols = d.columns;
    const container = findContainer(active.id, cols);
    if (container && container === findContainer(over.id, cols)) {
      const from = cols[container].indexOf(active.id);
      const to = cols[container].indexOf(over.id);
      if (to !== -1 && from !== to) cols = { ...cols, [container]: arrayMove(cols[container], from, to) };
    }
    onReorder(cols);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active }) => setDragState({ activeId: active.id, columns: columnsOf(trip) })}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragState(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable: 'To pick up a stop, press space or enter. Use the arrow keys to move it, space or enter to drop, escape to cancel.',
        },
      }}
    >
      <div className="days">
        {trip.days.map((day, i) => (
          <DaySection
            key={day.id}
            day={day}
            index={i}
            stopIds={columns[day.id] ?? []}
            stopsById={stopsById}
            shared={shared}
            onAddStop={onAddStop}
            onRemoveDay={onRemoveDay}
            canRemoveDay={trip.days.length > 1}
          />
        ))}
      </div>
      <DragOverlay>
        {activeStop ? (
          <StopCard
            stop={activeStop}
            dayIndex={0}
            {...shared}
            expanded={false}
            isFirst={false}
            isLast={false}
            overlay
            handleProps={{}}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
