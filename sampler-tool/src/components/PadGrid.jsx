import React, { useState, useEffect, useRef } from 'react';
import './PadGrid.css';

const ROWS = 4;
const COLS = 4;

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

export const PadGrid = ({ samples, onPadClick, selectedPadId, onPadFilePicked }) => {
  const [activePads, setActivePads] = useState(new Set());
  const fileInputRef = useRef(null);
  const filePickPadIdRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat) return;
      // Ignore when focus is on a text input (BPM, etc.)
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
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

  const handlePointerDown = (padId) => {
    onPadClick(padId);
    setActivePads((prev) => new Set([...prev, padId]));
  };

  const handlePointerUp = (padId) => {
    setActivePads((prev) => {
      const next = new Set(prev);
      next.delete(padId);
      return next;
    });
  };

  const handleAddClick = (padId, e) => {
    e.stopPropagation();
    filePickPadIdRef.current = padId;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    const padId = filePickPadIdRef.current;
    if (file && padId) {
      onPadFilePicked?.(padId, file);
    }
    e.target.value = '';
    filePickPadIdRef.current = null;
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
          onPointerDown={() => handlePointerDown(padId)}
          onPointerUp={() => handlePointerUp(padId)}
          onPointerLeave={() => handlePointerUp(padId)}
          onPointerCancel={() => handlePointerUp(padId)}
          title={sample ? sample.name : 'Drop sample here or tap + to pick a file'}
          style={{ touchAction: 'manipulation' }}
          role="button"
          aria-label={`Pad ${padNumber} (key ${key.toUpperCase()}), ${sample ? sample.name : 'empty'}`}
        >
          <div className="pad-corner pad-number">{padNumber.toString().padStart(2, '0')}</div>
          <div className="pad-corner pad-key">{key.toUpperCase()}</div>
          {sample ? (
            <span className="sample-name">{sample.name.split('.')[0]}</span>
          ) : (
            <>
              <span className="drop-hint">DROP</span>
              <button
                type="button"
                className="pad-add-btn"
                onClick={(e) => handleAddClick(padId, e)}
                onPointerDown={(e) => e.stopPropagation()}
                title="Pick a file"
                aria-label={`Pick file for pad ${padNumber}`}
              >
                +
              </button>
            </>
          )}
        </div>
      );
    }
  }

  return (
    <div className="pad-grid-wrap">
      <div className="pad-grid">{pads}</div>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.ogg,.m4a"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};
