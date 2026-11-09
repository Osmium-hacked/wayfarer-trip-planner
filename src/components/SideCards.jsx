import { Check, Luggage, Plus, Wallet, X } from 'lucide-react';
import { useState } from 'react';
import { formatMoney } from '../lib/format.js';

export function BudgetCard({ budget, currency }) {
  if (!budget.length) return null;
  const total = budget.reduce((sum, b) => sum + b.amount, 0);
  const max = Math.max(...budget.map((b) => b.amount));
  return (
    <section className="card side-card" aria-labelledby="budget-heading">
      <header className="side-card__head">
        <Wallet size={16} aria-hidden="true" />
        <h3 id="budget-heading">Budget estimate</h3>
      </header>
      <p className="budget__total">
        {formatMoney(total, currency)}
        <span> per person</span>
      </p>
      <ul className="budget__bars">
        {budget.map((b, i) => (
          <li key={`${b.category}-${i}`}>
            <div className="budget__row">
              <span>{b.category}</span>
              <span className="budget__amount">{formatMoney(b.amount, currency)}</span>
            </div>
            <div
              className="budget__track"
              role="meter"
              aria-label={`${b.category}: ${Math.round((b.amount / total) * 100)}% of budget`}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={b.amount}
            >
              <span className="budget__fill" style={{ '--w': `${(b.amount / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="side-card__foot">AI estimate. Real prices vary.</p>
    </section>
  );
}

export function PackingCard({ items, onToggle, onAdd, onRemove, locked }) {
  const [draft, setDraft] = useState('');
  const done = items.filter((i) => i.checked).length;
  return (
    <section className="card side-card" aria-labelledby="packing-heading">
      <header className="side-card__head">
        <Luggage size={16} aria-hidden="true" />
        <h3 id="packing-heading">Packing list</h3>
        {items.length > 0 && (
          <span className="side-card__count">
            {done}/{items.length}
          </span>
        )}
      </header>
      {items.length > 0 && (
        <div className="progress-line" aria-hidden="true">
          <span style={{ '--w': `${(done / items.length) * 100}%` }} />
        </div>
      )}
      <ul className="checklist">
        {items.map((item) => (
          <li key={item.id} className={item.checked ? 'is-checked' : ''}>
            <label>
              <input type="checkbox" checked={item.checked} disabled={locked} onChange={() => onToggle(item.id)} />
              <span className="checklist__box" aria-hidden="true">
                <Check size={12} />
              </span>
              <span className="checklist__text">{item.text}</span>
            </label>
            <button type="button" className="icon-btn icon-btn--xs" aria-label={`Remove ${item.text}`} disabled={locked} onClick={() => onRemove(item.id)}>
              <X size={12} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="inline-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          onAdd(draft.trim().slice(0, 80));
          setDraft('');
        }}
      >
        <input className="input input--sm" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add an item" aria-label="New packing item" disabled={locked} />
        <button type="submit" className="icon-btn icon-btn--sm" aria-label="Add item" disabled={locked || !draft.trim()}>
          <Plus size={15} />
        </button>
      </form>
    </section>
  );
}
