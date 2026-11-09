import { useCallback, useEffect, useState } from 'react';

const KEY = 'wayfarer:theme';
const ORDER = ['system', 'light', 'dark'];

function readTheme() {
  try {
    const t = localStorage.getItem(KEY);
    return ORDER.includes(t) ? t : 'system';
  } catch {
    return 'system';
  }
}

/** 'system' follows the OS; 'light'/'dark' pin it. Applied via <html data-theme>. */
export function useTheme() {
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const cycle = useCallback(() => setTheme((t) => ORDER[(ORDER.indexOf(t) + 1) % ORDER.length]), []);
  return { theme, cycle };
}
