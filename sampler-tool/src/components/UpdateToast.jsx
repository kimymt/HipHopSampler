import React from 'react';
import './UpdateToast.css';

/**
 * Bottom-right ephemeral toast.
 * Priority order: needRefresh > persistResult > offlineReady. Only one shown at a time.
 */
export const UpdateToast = ({
  needRefresh,
  offlineReady,
  persistResult,
  onApply,
  onDismissUpdate,
  onDismissOffline,
  onDismissPersist,
}) => {
  if (needRefresh) {
    return (
      <div className="pwa-toast pwa-toast-update" role="status">
        <div className="pwa-toast-body">
          <strong>新バージョンあります</strong>
          <span>更新を適用しますか？</span>
        </div>
        <div className="pwa-toast-actions">
          <button className="pwa-toast-btn primary" onClick={onApply}>更新</button>
          <button className="pwa-toast-btn" onClick={onDismissUpdate}>あとで</button>
        </div>
      </div>
    );
  }
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
