import React from 'react';
import './TransportBar.css';

export const TransportBar = ({ bpm, onBpmChange, isPlaying, onPlayToggle, isRecording, onRecordToggle, loadedCount, onHelpClick }) => {
  return (
    <div className="transport-bar">
      <div className="transport-section logo-section">
        <div className="logo-mark">▣</div>
        <div className="logo-text">
          <div className="logo-title">HIP HOP SAMPLER</div>
          <div className="logo-sub">v0.1 · prototype</div>
        </div>
      </div>

      <div className="transport-section controls-section">
        <button
          className={`transport-btn play ${isPlaying ? 'active' : ''}`}
          onClick={onPlayToggle}
          title="Play / Stop"
        >
          {isPlaying ? '■' : '▶'}
        </button>
        <button
          className={`transport-btn record ${isRecording ? 'active' : ''}`}
          onClick={onRecordToggle}
          title="Record pattern"
        >
          ●
        </button>

        <div className="bpm-control">
          <label>BPM</label>
          <input
            type="number"
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
          <span>{isPlaying ? 'PLAYING' : 'IDLE'}</span>
        </div>
        <button
          className="tour-help-btn"
          onClick={onHelpClick}
          title="ツアーを再生"
          aria-label="Show tour"
        >
          ?
        </button>
      </div>
    </div>
  );
};
