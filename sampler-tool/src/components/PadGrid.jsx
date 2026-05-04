import React, { useState, useEffect } from 'react';
import './PadGrid.css';

const ROWS = 4;
const COLS = 4;

// 4x4 MPC風レイアウト + キーボードマップ
const PAD_KEYS = [
  ['1', '2', '3', '4'],
  ['q', 'w', 'e', 'r'],
  ['a', 's', 'd', 'f'],
  ['z', 'x', 'c', 'v'],
];

const KEYBOARD_MAP = {};
PAD_KEYS.forEach((row, rIdx) => {
  row.forEach((key, cIdx) => {
    KEYBOARD_MAP[key] = [rIdx, cIdx];
  });
});

export const PadGrid = ({ samples, onPadClick, selectedPadId }) => {
  const [activePads, setActivePads] = useState(new Set());

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      const position = KEYBOARD_MAP[key];
      if (position) {
        const [row, col] = position;
        const padId = `${row}-${col}`;
        onPadClick(padId);
        setActivePads((prev) => new Set([...prev, padId]));
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      const position = KEYBOARD_MAP[key];
      if (position) {
        const [row, col] = position;
        const padId = `${row}-${col}`;
        setActivePads((prev) => {
          const next = new Set(prev);
          next.delete(padId);
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onPadClick]);

  const handleMouseDown = (padId) => {
    onPadClick(padId);
    setActivePads((prev) => new Set([...prev, padId]));
  };

  const handleMouseUp = (padId) => {
    setActivePads((prev) => {
      const next = new Set(prev);
      next.delete(padId);
      return next;
    });
  };

  const pads = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const padId = `${row}-${col}`;
      const sample = samples[padId];
      const isActive = activePads.has(padId);
      const isSelected = selectedPadId === padId;
      const padNumber = row * COLS + col + 1;
      const key = PAD_KEYS[row][col];

      pads.push(
        <div
          key={padId}
          className={`pad ${isActive ? 'active' : ''} ${sample ? 'loaded' : 'empty'} ${isSelected ? 'selected' : ''}`}
          onMouseDown={() => handleMouseDown(padId)}
          onMouseUp={() => handleMouseUp(padId)}
          onMouseLeave={() => handleMouseUp(padId)}
          title={sample ? sample.name : 'Drop sample here or click to select'}
        >
          <div className="pad-corner pad-number">{padNumber.toString().padStart(2, '0')}</div>
          <div className="pad-corner pad-key">{key.toUpperCase()}</div>
          {sample ? (
            <span className="sample-name">{sample.name.split('.')[0]}</span>
          ) : (
            <span className="drop-hint">DROP</span>
          )}
        </div>
      );
    }
  }

  return <div className="pad-grid-wrap">
    <div className="pad-grid">{pads}</div>
  </div>;
};
