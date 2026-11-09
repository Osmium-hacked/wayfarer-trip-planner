import {
  BedDouble,
  CircleDot,
  Landmark,
  ShoppingBag,
  Ticket,
  TrainFront,
  Trees,
  Utensils,
  Wine,
} from 'lucide-react';

export const CATEGORY_META = {
  sight: { label: 'Sight', Icon: Landmark },
  food: { label: 'Food & drink', Icon: Utensils },
  activity: { label: 'Activity', Icon: Ticket },
  nature: { label: 'Nature', Icon: Trees },
  shopping: { label: 'Shopping', Icon: ShoppingBag },
  nightlife: { label: 'Nightlife', Icon: Wine },
  transport: { label: 'Transport', Icon: TrainFront },
  lodging: { label: 'Stay', Icon: BedDouble },
  other: { label: 'Other', Icon: CircleDot },
};

export function CategoryIcon({ category, size = 16 }) {
  const { Icon } = CATEGORY_META[category] ?? CATEGORY_META.other;
  return <Icon size={size} aria-hidden="true" />;
}

export function Logo() {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" className="logo-mark">
      <circle cx="16" cy="16" r="15" fill="var(--accent)" />
      <path d="M16 6.5 19.2 16 16 25.5 12.8 16Z" fill="var(--accent-ink)" />
      <path d="M16 6.5 19.2 16h-6.4Z" fill="var(--accent-ink)" opacity=".55" />
      <circle cx="16" cy="16" r="1.6" fill="var(--accent)" />
    </svg>
  );
}
