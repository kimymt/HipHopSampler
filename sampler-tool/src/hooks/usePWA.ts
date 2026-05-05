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

  // SW registration + offline-ready flow.
  // With registerType: 'autoUpdate' (vite.config.js), new SW versions skipWaiting
  // and clientsClaim automatically. We don't expose a needRefresh prompt to the
  // user — updates apply silently and the new bundle appears on the next page
  // load. This avoids the "ignored toast → stuck on old version" failure mode.
  const {
    offlineReady: [offlineReady, setOfflineReady],
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Re-check for updates every 30 minutes while the tab is open. Shorter
      // than the previous 1h so deploys propagate to long-lived sessions
      // (e.g. an iPad PWA left open) within half an hour.
      if (registration) {
        setInterval(() => {
          registration.update().catch(() => {});
        }, 30 * 60 * 1000);
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
    offlineReady,
    dismissOfflineReady: () => setOfflineReady(false),
  };
};
