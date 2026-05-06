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

export const PadGrid = ({
  samples,
  onPadClick,
  onPadLongPress,
  selectedPadId,
  onPadFilePicked,
  micSupported = false,
  recordingPadId = null,
  recordingElapsedMs = 0,
  onMicStart,
  onMicStop,
}) => {
  const [activePads, setActivePads] = useState(new Set());
  const fileInputRef = useRef(null);
  const filePickPadIdRef = useRef(null);
  // Long-press detection. Tap-and-hold for ~350ms on a loaded pad opens the
  // sample editor sheet (mobile UX: tap = play, hold = edit). Without this,
  // mobile users could not perform — every tap was force-opening the sheet
  // and covering the pad grid.
  const longPressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);
  const LONG_PRESS_MS = 350;

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
    // Schedule long-press only if a long-press handler is wired.
    if (onPadLongPress) {
      longPressFiredRef.current = false;
      longPressTimerRef.current = setTimeout(() => {
        longPressFiredRef.current = true;
        onPadLongPress(padId);
      }, LONG_PRESS_MS);
    }
  };

  const handlePointerUp = (padId) => {
    setActivePads((prev) => {
      const next = new Set(prev);
      next.delete(padId);
      return next;
    });
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleAddClick = (padId, e) => {
    e.stopPropagation();
    filePickPadIdRef.current = padId;
    fileInputRef.current?.click();
  };

  const handleMicClick = (padId, e) => {
    e.stopPropagation();
    if (recordingPadId === padId) {
      onMicStop?.();
    } else if (!recordingPadId) {
      onMicStart?.(padId);
    }
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
      const isRecording = recordingPadId === padId;
      const padNumber = row * COLS + col + 1;
      const key = PAD_KEYS[row][col];
      const elapsedSec = isRecording ? (recordingElapsedMs / 1000).toFixed(1) : null;

      pads.push(
        <div
          key={padId}
          className={`pad ${isActive ? 'active' : ''} ${sample ? 'loaded' : 'empty'} ${isSelected ? 'selected' : ''} ${isRecording ? 'recording' : ''}`}
          onPointerDown={() => !isRecording && handlePointerDown(padId)}
          onPointerUp={() => handlePointerUp(padId)}
          onPointerLeave={() => handlePointerUp(padId)}
          onPointerCancel={() => handlePointerUp(padId)}
          title={isRecording ? 'Recording — tap mic to stop' : sample ? sample.name : '🎙 to record from mic, + to pick a file, or drop audio here'}
          style={{ touchAction: 'manipulation' }}
          role="button"
          aria-label={`Pad ${padNumber} (key ${key.toUpperCase()}), ${isRecording ? 'recording' : sample ? sample.name : 'empty'}`}
        >
          <div className="pad-corner pad-number">{padNumber.toString().padStart(2, '0')}</div>
          <div className="pad-corner pad-key">{key.toUpperCase()}</div>
          {isRecording ? (
            <span className="rec-elapsed">REC {elapsedSec}s</span>
          ) : sample ? (
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
              {micSupported && (
                <button
                  type="button"
                  className="pad-mic-btn"
                  onClick={(e) => handleMicClick(padId, e)}
                  onPointerDown={(e) => e.stopPropagation()}
                  disabled={!!recordingPadId && !isRecording}
                  title="Record from microphone"
                  aria-label={`Record mic for pad ${padNumber}`}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V20H8v2h8v-2h-3v-2.08A7 7 0 0 0 19 11h-2z"
                    />
                  </svg>
                </button>
              )}
            </>
          )}
          {isRecording && (
            <button
              type="button"
              className="pad-mic-btn pad-mic-btn--stop"
              onClick={(e) => handleMicClick(padId, e)}
              onPointerDown={(e) => e.stopPropagation()}
              title="Stop recording"
              aria-label={`Stop recording for pad ${padNumber}`}
            >
              <span className="rec-stop-square" />
            </button>
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
