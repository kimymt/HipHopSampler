import React, { useRef, useCallback, useEffect } from 'react';
import { InstallButton } from './InstallButton';
import { StorageBadge } from './StorageBadge';
import { OfflineBadge } from './OfflineBadge';
import { useIsMobile } from '../hooks/useMediaQuery';
import './TransportBar.css';

const BPM_MIN = 60;
const BPM_MAX = 200;
const BPM_HOLD_DELAY = 400;
const BPM_HOLD_INTERVAL = 80;
const clampBpm = (n) => Math.max(BPM_MIN, Math.min(BPM_MAX, n));

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

  // Long-press auto-repeat for the BPM stepper. Tap = ±1, hold = continuous.
  const stepperHold = useRef(null);
  const stepperStart = useRef(null);
  const stopStepper = useCallback(() => {
    if (stepperStart.current) clearTimeout(stepperStart.current);
    if (stepperHold.current) clearInterval(stepperHold.current);
    stepperStart.current = null;
    stepperHold.current = null;
  }, []);
  useEffect(() => stopStepper, [stopStepper]);
  const startStepper = useCallback(
    (delta) => {
      onBpmChange((cur) => clampBpm(cur + delta));
      stepperStart.current = setTimeout(() => {
        stepperHold.current = setInterval(() => {
          onBpmChange((cur) => clampBpm(cur + delta));
        }, BPM_HOLD_INTERVAL);
      }, BPM_HOLD_DELAY);
    },
    [onBpmChange]
  );

  return (
    <div className={`transport-bar ${isMobile ? 'tight' : ''}`}>
      <div className="transport-section logo-section">
        <div className="logo-mark">▣</div>
        <div className="logo-text">
          <h1 className="logo-title">{isMobile ? 'HHS' : 'HIP HOP SAMPLER'}</h1>
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

        <div className="bpm-stepper">
          <button
            type="button"
            className="bpm-step bpm-step--down"
            aria-label="BPMを下げる"
            title="BPM −"
            onPointerDown={(e) => {
              e.preventDefault();
              startStepper(-1);
            }}
            onPointerUp={stopStepper}
            onPointerLeave={stopStepper}
            onPointerCancel={stopStepper}
            disabled={bpm <= BPM_MIN}
          >
            −
          </button>
          <div className="bpm-control">
            <label htmlFor="bpm-input">BPM</label>
            <input
              id="bpm-input"
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={BPM_MIN}
              max={BPM_MAX}
              value={bpm}
              onChange={(e) => {
                const n = parseInt(e.target.value);
                onBpmChange(Number.isFinite(n) ? clampBpm(n) : 90);
              }}
            />
          </div>
          <button
            type="button"
            className="bpm-step bpm-step--up"
            aria-label="BPMを上げる"
            title="BPM +"
            onPointerDown={(e) => {
              e.preventDefault();
              startStepper(1);
            }}
            onPointerUp={stopStepper}
            onPointerLeave={stopStepper}
            onPointerCancel={stopStepper}
            disabled={bpm >= BPM_MAX}
          >
            +
          </button>
        </div>
      </div>

      <div className="transport-section status-section">
        {/* Mobile redacts PADS counter, IDLE/PLAY LED, and OfflineBadge so the
         * settings cog stays inside the viewport on iPhone (see commit msg).
         * Information not lost: PADS count is implicit from pad coloring,
         * play/idle is implicit from the play button itself, online state
         * surfaces via the AI 提案 row text inside Settings. */}
        {!isMobile && (
          <>
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

        <button
          className="settings-btn"
          onClick={onSettingsClick}
          title="設定"
          aria-label="Settings"
        >
          ⚙
        </button>
      </div>
    </div>
  );
};
