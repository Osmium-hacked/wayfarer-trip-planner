import { Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, createStop } from '../lib/normalize.js';
import { CATEGORY_META } from './icons.jsx';

export function AddStopForm({ dayId, onAdd, locked }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [time, setTime] = useState('');
  const [category, setCategory] = useState('sight');
  const nameRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    if (open) nameRef.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    setName('');
    setTime('');
    setTimeout(() => openerRef.current?.focus(), 0);
  };

  if (!open) {
    return (
      <button ref={openerRef} type="button" className="add-stop" data-day-add={dayId} disabled={locked} onClick={() => setOpen(true)}>
        <Plus size={16} aria-hidden="true" /> Add a stop
      </button>
    );
  }

  const submit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return nameRef.current?.focus();
    onAdd(dayId, createStop({ name: trimmed.slice(0, 120), time, category }));
    setName('');
    setTime('');
    nameRef.current?.focus(); // stay open for quick multi-add
  };

  return (
    <form className="add-stop-form fade-in" onSubmit={submit} onKeyDown={(e) => e.key === 'Escape' && close()}>
      <input
        ref={nameRef}
        className="input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Place or activity"
        aria-label="Stop name"
        maxLength={120}
      />
      <input className="input input--time" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Start time" />
      <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_META[c].label}
          </option>
        ))}
      </select>
      <div className="add-stop-form__actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={close}>
          Done
        </button>
        <button type="submit" className="btn btn--primary btn--sm" disabled={!name.trim()}>
          Add
        </button>
      </div>
    </form>
  );
}
