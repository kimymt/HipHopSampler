import React, { useEffect, useRef, useState } from 'react';
import { chipKeywords, type PresetEntry } from '../effects/presetDictionary';
import type { FxState } from '../effects/types';
import './EffectVibeChips.css';

interface Props {
  fx: FxState;
  onFxChange: (next: FxState) => void;
  /**
   * Called when a chip is applied — used by parent to surface the chosen vibe
   * in the LCD description (aria-live for screen readers, visible 1.5s).
   */
  onVibeAnnounce?: (message: string) => void;
}

/**
 * EffectVibeChips — DESIGN.md §9.15.
 *
 * Why this exists:
 *   The persona (DAW挫折者) freezes when faced with type buttons + WET + PARAM
 *   knobs. "水中" is concrete; "filter cutoff 20%" is not. Chips give a
 *   1-tap entry that auto-syncs the underlying type/wet/param so the user
 *   _learns_ the mapping by watching the knobs animate (250ms ease-out).
 *
 * Why no text input here:
 *   Phase 2A intentionally ships chip-only. A blank text input is the exact
 *   blank-page anxiety the persona is escaping. Free-form input arrives in
 *   Phase 2B with WebLLM backing it.
 */
export const EffectVibeChips: React.FC<Props> = ({ fx, onFxChange, onVibeAnnounce }) => {
  const animFromRef = useRef<FxState | null>(null);
  const animTargetRef = useRef<PresetEntry | null>(null);
  const animStartRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);

  // Cancel any in-flight ramp on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Detect manual interaction (knob drag, type button) and clear "active" chip
  // highlight. We compare current fx against the chip target — if it diverges
  // by more than a small epsilon, the user is now driving manually.
  useEffect(() => {
    if (activeKeyword === null) return;
    const target = chipKeywords.find((e) => e.keyword === activeKeyword);
    if (!target) return;
    const drift =
      Math.abs(fx.wet - target.wet) +
      Math.abs(fx.param - target.param) +
      (fx.type !== target.type ? 1 : 0);
    if (drift > 0.05 && animTargetRef.current === null) {
      setActiveKeyword(null);
    }
  }, [fx, activeKeyword]);

  const applyPreset = (entry: PresetEntry) => {
    // Respect prefers-reduced-motion: skip the animated ramp.
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setActiveKeyword(entry.keyword);

    if (onVibeAnnounce) {
      const wetPct = Math.round(entry.wet * 100);
      const paramPct = Math.round(entry.param * 100);
      onVibeAnnounce(`→ ${entry.type.toUpperCase()} WET ${wetPct}% · ${paramPct}%`);
    }

    if (reduceMotion) {
      onFxChange({ type: entry.type, wet: entry.wet, param: entry.param });
      return;
    }

    // Cancel any prior ramp.
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // Switch the type immediately so the active button updates; only WET/PARAM
    // ramp so the knob movement is the visible learning signal.
    onFxChange({ type: entry.type, wet: fx.wet, param: fx.param });
    animFromRef.current = { type: entry.type, wet: fx.wet, param: fx.param };
    animTargetRef.current = entry;
    animStartRef.current = performance.now();

    const DURATION = 250;
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (now: number) => {
      const from = animFromRef.current;
      const target = animTargetRef.current;
      if (!from || !target) return;
      const t = Math.min(1, (now - animStartRef.current) / DURATION);
      const e = easeOut(t);
      const wet = from.wet + (target.wet - from.wet) * e;
      const param = from.param + (target.param - from.param) * e;
      onFxChange({ type: target.type, wet, param });
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        animFromRef.current = null;
        animTargetRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  return (
    <div
      className="effect-vibe-chips"
      role="toolbar"
      aria-label="エフェクトプリセット (タップで音色を一発適用)"
    >
      <div className="effect-vibe-chips-scroll">
        {chipKeywords.map((entry) => (
          <button
            key={entry.keyword}
            type="button"
            className={`effect-vibe-chip ${activeKeyword === entry.keyword ? 'is-active' : ''}`}
            onClick={() => applyPreset(entry)}
            aria-pressed={activeKeyword === entry.keyword}
            aria-label={entry.description ? `${entry.keyword} — ${entry.description}` : entry.keyword}
          >
            {entry.keyword}
          </button>
        ))}
      </div>
    </div>
  );
};
