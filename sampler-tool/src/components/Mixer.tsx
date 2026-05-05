import React from 'react';
import './Mixer.css';

export const Mixer = ({ sample, padId, onVolumeChange, onPanChange, onRemove, onAutoChop, chopMessage }) => {
  if (!sample || !sample.buffer) {
    return (
      <div className="mixer mixer-empty">
        <div className="mixer-placeholder">
          <div className="placeholder-icon">▤</div>
          <div className="placeholder-text">SELECT A PAD</div>
          <div className="placeholder-sub">to edit sample</div>
        </div>
      </div>
    );
  }

  const padNumber = padId ? parseInt(padId.split('-')[0]) * 4 + parseInt(padId.split('-')[1]) + 1 : 0;
  const inChopGroup = !!sample.chopGroup;

  return (
    <div className="mixer">
      <div className="mixer-header">
        <div className="mixer-title">
          <span className="mixer-label">SAMPLE</span>
          <span className="mixer-padnum">PAD {padNumber.toString().padStart(2, '0')}</span>
          {inChopGroup && <span className="mixer-chop-tag">CHOP {(sample.chopIndex ?? 0) + 1}</span>}
        </div>
        <button className="mixer-remove" onClick={onRemove} title="Remove sample">×</button>
      </div>

      <div className="mixer-name">{sample.name}</div>

      <div className="mixer-meta">
        <div className="meta-item">
          <span className="meta-label">DUR</span>
          <span className="meta-value">{sample.buffer.duration.toFixed(2)}s</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">CH</span>
          <span className="meta-value">{sample.buffer.numberOfChannels}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">SR</span>
          <span className="meta-value">{(sample.buffer.sampleRate / 1000).toFixed(1)}k</span>
        </div>
      </div>

      <div className="mixer-controls">
        <div className="knob-control">
          <label>VOLUME</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={sample.volume ?? 1}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          />
          <span className="knob-value">{Math.round((sample.volume ?? 1) * 100)}</span>
        </div>

        <div className="knob-control">
          <label>PAN</label>
          <input
            type="range"
            min="-1"
            max="1"
            step="0.01"
            value={sample.pan ?? 0}
            onChange={(e) => onPanChange && onPanChange(parseFloat(e.target.value))}
          />
          <span className="knob-value">{Math.round((sample.pan ?? 0) * 100)}</span>
        </div>
      </div>

      <div className="chop-section">
        <button className="chop-btn" onClick={onAutoChop} title="Detect drum hits and split into pads">
          ✂ AUTO CHOP
        </button>
        <div className="chop-hint">
          {chopMessage || '長い音源を検出してパッドに自動分割。境界線はあとからドラッグで調整できる'}
        </div>
      </div>
    </div>
  );
};
