export function formatDuration(minutes) {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const moneyFormatters = new Map();
export function formatMoney(amount, currency) {
  if (amount == null) return '';
  if (amount === 0) return 'Free';
  if (currency) {
    try {
      let fmt = moneyFormatters.get(currency);
      if (!fmt) {
        fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 });
        moneyFormatters.set(currency, fmt);
      }
      return fmt.format(amount);
    } catch {
      /* unknown currency code */
    }
  }
  return `${Math.round(amount).toLocaleString()}${currency ? ` ${currency}` : ''}`;
}

export function formatRelativeTime(timestamp, now = Date.now()) {
  const diff = Math.round((timestamp - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return new Date(timestamp).toLocaleDateString();
}

export function mapsUrl(stop, destination) {
  const query = [stop.name, stop.location || destination].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
