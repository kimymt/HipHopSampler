import React from 'react';
import './Sequencer.css';

const STEPS = 16;

export const Sequencer = ({ pattern, onToggleStep, onClear, currentStep, selectedPadId, sampleName }) => {
  const steps = pattern || new Array(STEPS).fill(false);
  const hasAny = pattern && pattern.some(Boolean);

  return (
    <div className="sequencer">
      <div className="sequencer-header">
        <div className="sequencer-title">
          <span className="seq-label">SEQUENCER</span>
          <span className="seq-target">
            {selectedPadId ? `→ ${sampleName || 'Pad ' + selectedPadId}` : '→ select a pad'}
          </span>
        </div>
        <div className="sequencer-actions">
          {hasAny && (
            <button className="seq-clear" onClick={onClear} title="Clear pattern for this pad">
              CLEAR
            </button>
          )}
          <div className="sequencer-bars">
            <span>1</span><span>2</span><span>3</span><span>4</span>
          </div>
        </div>
      </div>

      <div className="sequencer-grid">
        {steps.map((on, idx) => {
          const isCurrent = currentStep === idx;
          const isBeat = idx % 4 === 0;
          return (
            <button
              key={idx}
              className={`step ${on ? 'on' : ''} ${isCurrent ? 'current' : ''} ${isBeat ? 'beat' : ''}`}
              onClick={() => selectedPadId && onToggleStep(idx)}
              disabled={!selectedPadId}
            >
              <span className="step-num">{idx + 1}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
