import React from 'react';
import './StartupLoader.css';

export const StartupLoader = ({ status, progress, total, error, onRetry, onClear }) => {
  if (status === 'idle' || status === 'ready') return null;

  if (status === 'error') {
    return (
      <div className="startup-overlay">
        <div className="startup-card">
          <div className="startup-icon error">⚠</div>
          <h3>サンプルの復元に失敗しました</h3>
          <p className="startup-msg">{error || '不明なエラー'}</p>
          <div className="startup-actions">
            {onRetry && <button className="startup-btn primary" onClick={onRetry}>再試行</button>}
            {onClear && <button className="startup-btn" onClick={onClear}>保存データを消して開始</button>}
          </div>
        </div>
      </div>
    );
  }

  // restoring
  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;
  return (
    <div className="startup-overlay">
      <div className="startup-card">
        <div className="startup-icon">↻</div>
        <h3>サンプルを復元中</h3>
        <p className="startup-msg">{progress} / {total} 個</p>
        <div className="startup-progress">
          <div className="startup-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
};
