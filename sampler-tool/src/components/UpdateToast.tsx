import React from 'react';
import './UpdateToast.css';

/**
 * Bottom-right ephemeral toast.
 *
 * SW updates auto-apply silently (vite.config.js: registerType 'autoUpdate' +
 * clientsClaim + skipWaiting), so there is no "新バージョン更新" prompt — users
 * get the new bundle on the next page load without having to tap a button.
 *
 * Priority: persistResult > offlineReady. Only one shown at a time.
 */
export const UpdateToast = ({
  offlineReady,
  persistResult,
  onDismissOffline,
  onDismissPersist,
}) => {
  if (persistResult === 'granted') {
    return (
      <div className="pwa-toast pwa-toast-persist" role="status">
        <div className="pwa-toast-body">
          <strong>🔒 ストレージを保護しました</strong>
          <span>サンプルが OS のクリーンアップで消えなくなりました</span>
        </div>
        <button className="pwa-toast-btn" onClick={onDismissPersist}>OK</button>
      </div>
    );
  }
  if (persistResult === 'denied') {
    return (
      <div className="pwa-toast pwa-toast-persist-denied" role="status">
        <div className="pwa-toast-body">
          <strong>⚠️ 自動保護できませんでした</strong>
          <span>容量逼迫時にサンプルが消える可能性。ホーム画面に追加すると保護されます</span>
        </div>
        <button className="pwa-toast-btn" onClick={onDismissPersist}>閉じる</button>
      </div>
    );
  }
  if (offlineReady) {
    return (
      <div className="pwa-toast pwa-toast-offline" role="status">
        <div className="pwa-toast-body">
          <strong>オフライン対応 OK</strong>
          <span>ネット無しでも起動できます</span>
        </div>
        <button className="pwa-toast-btn" onClick={onDismissOffline}>閉じる</button>
      </div>
    );
  }
  return null;
};
