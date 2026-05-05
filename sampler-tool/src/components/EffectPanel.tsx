import React, { useEffect, useRef, useState } from 'react';
import { EFFECT_META, EFFECT_TYPES, type EffectType, type FxState } from '../effects/types';
import { EffectVibeChips } from './EffectVibeChips';
import './EffectPanel.css';

interface Props {
  fx: FxState;
  onFxChange: (next: FxState) => void;
  bypass: boolean;
  onBypassChange: (next: boolean) => void;
}

/**
 * Master FX panel — single effect slot with WET + PARAM knobs.
 *
 * Why one effect at a time:
 *   The persona is "DAW挫折者". Effect chains are exactly the kind of
 *   complexity that drives beginners away. SP-404 / EP-133 famously stay
 *   single-effect-at-a-time and still feel powerful — we mirror that.
 *
 * Phase 2A (DESIGN.md §9.15):
 *   `EffectVibeChips` sits above `effect-type-row` as a 1-tap shortcut to
 *   {type, wet, param} presets. Type buttons + knobs remain as the manual
 *   path, so users see chip → knob ramp animation and learn the mapping.
 */
export const EffectPanel: React.FC<Props> = ({ fx, onFxChange, bypass, onBypassChange }) => {
  const meta = EFFECT_META[fx.type];
  const isActive = fx.type !== 'none' && !bypass;

  // Transient vibe announcement that overrides the static description for
  // 1.5s after a chip tap (§9.15). aria-live="polite" announces it to
  // screen readers exactly once.
  const [vibeAnnounce, setVibeAnnounce] = useState<string | null>(null);
  const announceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (announceTimerRef.current !== null) window.clearTimeout(announceTimerRef.current);
    };
  }, []);

  const handleVibeAnnounce = (message: string) => {
    setVibeAnnounce(message);
    if (announceTimerRef.current !== null) window.clearTimeout(announceTimerRef.current);
    announceTimerRef.current = window.setTimeout(() => {
      setVibeAnnounce(null);
      announceTimerRef.current = null;
    }, 1500);
  };

  const handleTypeChange = (type: EffectType) => {
    onFxChange({ ...fx, type });
  };

  return (
    <div className={`effect-panel ${isActive ? 'is-active' : ''}`}>
      <div className="effect-panel-header">
        <h2 className="effect-panel-label">エフェクト</h2>
        <button
          type="button"
          className={`effect-bypass-btn ${bypass ? 'is-bypassed' : ''}`}
          onClick={() => onBypassChange(!bypass)}
          aria-pressed={bypass}
          title={bypass ? 'Enable effect' : 'Bypass effect (A/B)'}
        >
          {bypass ? 'BYPASS' : 'ON'}
        </button>
      </div>

      <EffectVibeChips fx={fx} onFxChange={onFxChange} onVibeAnnounce={handleVibeAnnounce} />

      <div className="effect-type-row">
        {EFFECT_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={`effect-type-btn ${fx.type === t ? 'is-selected' : ''}`}
            onClick={() => handleTypeChange(t)}
            aria-pressed={fx.type === t}
          >
            {EFFECT_META[t].label}
          </button>
        ))}
      </div>

      {fx.type !== 'none' && (
        <>
          <div className="effect-knob-row">
            <label className="effect-knob">
              <span className="effect-knob-label">WET</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={fx.wet}
                onChange={(e) => onFxChange({ ...fx, wet: parseFloat(e.target.value) })}
                aria-label="Effect wet/dry mix"
              />
              <span className="effect-knob-value">{Math.round(fx.wet * 100)}%</span>
            </label>

            <label className="effect-knob">
              <span className="effect-knob-label">{meta.paramLabel}</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={fx.param}
                onChange={(e) => onFxChange({ ...fx, param: parseFloat(e.target.value) })}
                aria-label={meta.paramLabel}
              />
              <span className="effect-knob-value">{Math.round(fx.param * 100)}%</span>
            </label>
          </div>

          <div className="effect-description" aria-live="polite">
            {vibeAnnounce ?? meta.description}
          </div>
        </>
      )}
    </div>
  );
};
