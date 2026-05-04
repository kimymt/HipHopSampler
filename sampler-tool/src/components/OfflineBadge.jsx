import React from 'react';
import './OfflineBadge.css';

export const OfflineBadge = ({ online }) => {
  if (online) return null;
  return (
    <div className="offline-badge" title="ネット未接続。アプリは動作しますがアップデートチェックは止まっています">
      <span className="offline-dot" />
      <span>OFFLINE</span>
    </div>
  );
};
