import { useEffect, useState, useCallback } from 'react';
import { requestPersistentStorage, isPersisted } from '../utils/sampleStore';

const FLAG = 'sampler.persist.requested';

/**
 * Surface the persistent-storage handshake to the user.
 *
 * Browsers that grant persist() silently lock IDB against eviction, but
 * Safari prompts (or silently denies based on PWA install state). We call
 * the API once per device and remember the result so subsequent loads
 * don't re-ask.
 *
 * Returns:
 *   persisted        — current state (true after granted)
 *   recentlyResolved — true for ~5s after a request resolves (drives a toast)
 *   lastResult       — 'granted' | 'denied' | null
 *   request()        — explicit user-initiated request
 *   maybeRequestOnce() — fire-and-forget, idempotent across reloads
 */
export const usePersistentStorage = () => {
  const [persisted, setPersisted] = useState(false);
  const [recentlyResolved, setRecentlyResolved] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  // Initial probe
  useEffect(() => {
    isPersisted().then((p) => setPersisted(!!p)).catch(() => {});
  }, []);

  const handleResult = useCallback((granted) => {
    setPersisted(!!granted);
    setLastResult(granted ? 'granted' : 'denied');
    setRecentlyResolved(true);
    setTimeout(() => setRecentlyResolved(false), 5000);
  }, []);

  const request = useCallback(async () => {
    const granted = await requestPersistentStorage();
    localStorage.setItem(FLAG, granted ? 'granted' : 'denied');
    handleResult(granted);
    return granted;
  }, [handleResult]);

  const maybeRequestOnce = useCallback(async () => {
    if (localStorage.getItem(FLAG)) return; // already asked once
    const already = await isPersisted();
    if (already) {
      localStorage.setItem(FLAG, 'granted');
      setPersisted(true);
      return;
    }
    const granted = await requestPersistentStorage();
    localStorage.setItem(FLAG, granted ? 'granted' : 'denied');
    handleResult(granted);
  }, [handleResult]);

  const dismiss = useCallback(() => setRecentlyResolved(false), []);

  return {
    persisted,
    recentlyResolved,
    lastResult,
    request,
    maybeRequestOnce,
    dismiss,
  };
};
