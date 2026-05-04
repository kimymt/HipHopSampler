import React from 'react';
import { InstallButton } from './InstallButton';
import { StorageBadge } from './StorageBadge';
import { OfflineBadge } from './OfflineBadge';
import { useIsMobile } from '../hooks/useMediaQuery';
import './TransportBar.css';

export const TransportBar = ({
  bpm,
  onBpmChange,
  isPlaying,
  onPlayToggle,
  isRecording,
  onRecordToggle,
  loadedCount,
  onHelpClick,
  canInstall,
  onInstallClick,
  storageInfo,
  onSettingsClick,
  online = true,
}) => {
  const isMobile = useIsMobile();

  return (
    <div className={`transport-bar ${isMobile ? 'tight' : ''}`}>
      <div className="transport-section logo-section">
        <div className="logo-mark">▣</div>
        <div className="logo-text">
          <div className="logo-title">{isMobile ? 'HHS' : 'HIP HOP SAMPLER'}</div>
          {!isMobile && <div className="logo-sub">v0.1 · prototype</div>}
        </div>
      </div>

      <div className="transport-section controls-section">
        <button
          className={`transport-btn play ${isPlaying ? 'active' : ''}`}
          onClick={onPlayToggle}
          title="Play / Stop"
          aria-label={isPlaying ? 'Stop' : 'Play'}
        >
          {isPlaying ? '■' : '▶'}
        </button>
        {!isMobile && (
          <button
            className={`transport-btn record ${isRecording ? 'active' : ''}`}
            onClick={onRecordToggle}
            title="Record pattern"
            aria-label="Record"
          >
            ●
          </button>
        )}

        <div className="bpm-control">
          <label htmlFor="bpm-input">BPM</label>
          <input
            id="bpm-input"
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            min="60"
            max="200"
            value={bpm}
            onChange={(e) => onBpmChange(parseInt(e.target.value) || 90)}
          />
        </div>
      </div>

      <div className="transport-section status-section">
        <div className="status-item">
          <div className="status-label">PADS</div>
          <div className="status-value">
            <span className="status-num">{loadedCount}</span>
            <span className="status-denom">/16</span>
          </div>
        </div>
        <div className={`status-led ${isPlaying ? 'on' : ''}`}>
          <span className="led-dot"></span>
          <span>{isPlaying ? 'PLAY' : 'IDLE'}</span>
        </div>

        <OfflineBadge online={online} />

        {/* Desktop: inline. Mobile: hidden, accessible via ⚙ settings sheet. */}
        {!isMobile && (
          <>
            <StorageBadge info={storageInfo} />
            <InstallButton canInstall={canInstall} onClick={onInstallClick} />
            <button
              className="tour-help-btn"
              onClick={onHelpClick}
              title="ツアーを再生"
              aria-label="Show tour"
            >
              ?
            </button>
          </>
        )}

        {isMobile && (
          <button
            className="settings-btn"
            onClick={onSettingsClick}
            title="設定"
            aria-label="Settings"
          >
            ⚙
          </button>
        )}
      </div>
    </div>
  );
};
