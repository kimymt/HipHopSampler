import { useEffect, useState } from 'react';
import { estimateQuota, isPersisted } from '../utils/sampleStore';

/**
 * Periodic quota poll. Returns null if the API isn't supported.
 * Shape: { usage, quota, percent, persisted }
 */
export const useStorageQuota = (intervalMs = 30000) => {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let timer;

    const tick = async () => {
      const est = await estimateQuota();
      const persisted = await isPersisted();
      if (cancelled) return;
      if (est) setInfo({ ...est, persisted });
      timer = setTimeout(tick, intervalMs);
    };
    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [intervalMs]);

  return info;
};
