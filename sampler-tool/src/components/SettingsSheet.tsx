import React from 'react';
import { StorageBadge } from './StorageBadge';
import { LatencyBadge } from './LatencyBadge';
import { TOUR_STEP_COUNT } from './Tour';
import './SettingsSheet.css';

/**
 * Mobile settings sheet — collects auxiliary controls that don't fit the
 * tight transport bar: Record, Install, Help (Tour), Storage status.
 */
export const SettingsSheet = ({
  open,
  onClose,
  isRecording,
  onRecordToggle,
  canInstall,
  onInstallClick,
  onHelpClick,
  storageInfo,
  audioContext = null,
}) => {
  if (!open) return null;
  return (
    <div className="settings-root" onClick={onClose} role="dialog" aria-modal="true">
      <div className="settings-card" onClick={(e) => e.stopPropagation()}>
        <div className="settings-handle" />
        <div className="settings-header">
          <h3>設定</h3>
          <button className="settings-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="settings-row">
          <div className="settings-row-label">
            <strong>● 録音モード</strong>
            <span>再生中にパッドを叩いた瞬間を記録</span>
          </div>
          <button
            className={`settings-toggle ${isRecording ? 'on' : ''}`}
            onClick={() => { onRecordToggle(); }}
            aria-pressed={isRecording}
          >
            {isRecording ? 'ON' : 'OFF'}
          </button>
        </div>

        {canInstall && (
          <div className="settings-row">
            <div className="settings-row-label">
              <strong>↓ ホーム画面に追加</strong>
              <span>アプリのようにスタンドアロン起動できる</span>
            </div>
            <button
              className="settings-action primary"
              onClick={() => { onInstallClick(); onClose(); }}
            >
              インストール
            </button>
          </div>
        )}

        <div className="settings-row">
          <div className="settings-row-label">
            <strong>? 操作ガイド</strong>
            <span>{TOUR_STEP_COUNT}ステップのツアーを再生</span>
          </div>
          <button
            className="settings-action"
            onClick={() => { onHelpClick(); onClose(); }}
          >
            開く
          </button>
        </div>

        <div className="settings-row">
          <div className="settings-row-label">
            <strong>💾 ストレージ</strong>
            <span>サンプルとパターンの保存状態</span>
          </div>
          <StorageBadge info={storageInfo} />
        </div>

        <div className="settings-row">
          <div className="settings-row-label">
            <strong>⚡ オーディオ遅延</strong>
            <span>パッドを叩いてから音が出るまでの実測値</span>
          </div>
          <LatencyBadge audioContext={audioContext} />
        </div>
      </div>
    </div>
  );
};
