import { useEffect, useState } from 'react';

/**
 * Track navigator.onLine. PWA installs work fully offline, but the user
 * benefits from knowing when network is gone (so they don't try to update
 * or share and wonder why nothing happens).
 */
export const useOnlineStatus = () => {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return online;
};
