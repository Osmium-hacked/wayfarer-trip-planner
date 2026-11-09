import { useEffect, useState } from 'react';
import { fetchHealth } from '../lib/api.js';

/** Which backend mode we're talking to (demo vs live model). null while unknown / unreachable. */
export function useHealth() {
  const [health, setHealth] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal)
      .then(setHealth)
      .catch(() => {
        if (!controller.signal.aborted) setHealth({ ok: false });
      });
    return () => controller.abort();
  }, []);
  return health;
}
