import { useEffect, useState, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Single PWA hook covering:
 *  - Service worker registration + update prompt
 *  - Install prompt capture (Chrome/Edge/Android)
 *  - iOS detection (Safari has no beforeinstallprompt; we show manual guide)
 *  - Standalone-mode detection (already installed → hide button)
 */
export const usePWA = () => {
  const [installEvent, setInstallEvent] = useState(null);
  const [showIosGuide, setShowIosGuide] = useState(false);

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari uses navigator.standalone (non-standard, missing from lib.dom.d.ts)
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

  const isIos =
    typeof window !== 'undefined' &&
    /iPad|iPhone|iPod/.test(window.navigator.userAgent) &&
    !(window.navigator as Navigator & { standalone?: boolean }).standalone;

  // SW registration + update flow
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Re-check for updates every hour while the tab is open.
      if (registration) {
        setInterval(() => {
          registration.update().catch(() => {});
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(err) {
      console.warn('[PWA] SW registration failed:', err);
    },
  });

  // Capture beforeinstallprompt so we can fire it on demand
  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setInstallEvent(e);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    const onInstalled = () => setInstallEvent(null);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (isIos) {
      setShowIosGuide(true);
      return 'ios-guide';
    }
    if (!installEvent) return 'unavailable';
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    setInstallEvent(null);
    return outcome; // 'accepted' | 'dismissed'
  }, [installEvent, isIos]);

  const canInstall = !isStandalone && (installEvent != null || isIos);

  return {
    canInstall,
    isStandalone,
    isIos,
    promptInstall,
    showIosGuide,
    dismissIosGuide: () => setShowIosGuide(false),
    needRefresh,
    offlineReady,
    applyUpdate: () => updateServiceWorker(true),
    dismissUpdate: () => setNeedRefresh(false),
    dismissOfflineReady: () => setOfflineReady(false),
  };
};
