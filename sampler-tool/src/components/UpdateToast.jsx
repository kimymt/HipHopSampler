import React from 'react';
import './UpdateToast.css';

export const UpdateToast = ({ needRefresh, offlineReady, onApply, onDismissUpdate, onDismissOffline }) => {
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
