import React from 'react';
import './StorageBadge.css';

const fmtBytes = (n) => {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)}GB`;
};

export const StorageBadge = ({ info }) => {
  if (!info) return null;
  const pct = Math.round(info.percent * 100);
  const tight = info.percent > 0.85;
  const moderate = info.percent > 0.6 && !tight;
  return (
    <div
      className={`storage-badge ${tight ? 'tight' : moderate ? 'moderate' : ''}`}
      title={`使用 ${fmtBytes(info.usage)} / ${fmtBytes(info.quota)}${info.persisted ? ' · 永続化済' : ''}`}
    >
      <span className="storage-icon">{info.persisted ? '🔒' : '⚙'}</span>
      <span className="storage-label">DISK</span>
      <span className="storage-pct">{pct}%</span>
    </div>
  );
};
