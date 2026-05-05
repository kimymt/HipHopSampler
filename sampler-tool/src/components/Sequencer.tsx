import React, { useState, useEffect } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { padIdToDisplayString } from '../utils/padId';
import './Sequencer.css';

const STEPS = 16;
const STEPS_PER_BAR = 4;
const BARS = 4;

export const Sequencer = ({ pattern, onToggleStep, onClear, currentStep, selectedPadId, sampleName }) => {
  const isMobile = useIsMobile();
  const steps = pattern || new Array(STEPS).fill(false);
  const hasAny = pattern && pattern.some(Boolean);

  // On mobile, show one bar at a time. Auto-advance during playback.
  const [currentBar, setCurrentBar] = useState(0);
  useEffect(() => {
    if (!isMobile) return;
    if (currentStep < 0) return;
    const playingBar = Math.floor(currentStep / STEPS_PER_BAR);
    if (playingBar !== currentBar) setCurrentBar(playingBar);
  }, [currentStep, isMobile, currentBar]);

  const visibleStart = isMobile ? currentBar * STEPS_PER_BAR : 0;
  const visibleEnd = isMobile ? visibleStart + STEPS_PER_BAR : STEPS;
  const visibleSteps = steps.slice(visibleStart, visibleEnd);

  return (
    <div className={`sequencer ${isMobile ? 'mobile' : ''}`}>
      <div className="sequencer-header">
        <div className="sequencer-title">
          <h2 className="seq-label">シーケンサー</h2>
          <span className="seq-target">
            {selectedPadId
              ? `→ ${sampleName || `PAD ${padIdToDisplayString(selectedPadId)}`}`
              : '→ select a pad'}
          </span>
        </div>
        <div className="sequencer-actions">
          {hasAny && (
            <button className="seq-clear" onClick={onClear} title="Clear pattern">
              CLEAR
            </button>
          )}
          {!isMobile && (
            <div className="sequencer-bars">
              <span>1</span><span>2</span><span>3</span><span>4</span>
            </div>
          )}
        </div>
      </div>

      {isMobile && (
        <div className="seq-tabs" role="tablist">
          {Array.from({ length: BARS }, (_, i) => (
            <button
              key={i}
              className={`seq-tab ${currentBar === i ? 'active' : ''}`}
              onClick={() => setCurrentBar(i)}
              role="tab"
              aria-selected={currentBar === i}
            >
              BAR {i + 1}
            </button>
          ))}
        </div>
      )}

      <div className={`sequencer-grid ${isMobile ? 'mobile-grid' : ''}`}>
        {visibleSteps.map((on, idx) => {
          const stepIdx = visibleStart + idx;
          const isCurrent = currentStep === stepIdx;
          const isBeat = stepIdx % 4 === 0;
          return (
            <button
              key={stepIdx}
              className={`step ${on ? 'on' : ''} ${isCurrent ? 'current' : ''} ${isBeat ? 'beat' : ''}`}
              onClick={() => selectedPadId && onToggleStep(stepIdx)}
              disabled={!selectedPadId}
              aria-label={`Step ${stepIdx + 1}, ${on ? 'on' : 'off'}`}
            >
              <span className="step-num">{stepIdx + 1}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
