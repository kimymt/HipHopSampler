import React, { useEffect, useRef, useState } from 'react';
import { chipKeywords, type PresetEntry } from '../effects/presetDictionary';
import type { FxState, EffectType } from '../effects/types';
import type { VibeInferenceResult } from '../ai/webllmClient';
import './EffectVibeChips.css';

interface Props {
  fx: FxState;
  onFxChange: (next: FxState) => void;
  /**
   * Called when a chip is applied — used by parent to surface the chosen vibe
   * in the LCD description (aria-live for screen readers, visible 1.5s).
   */
  onVibeAnnounce?: (message: string) => void;
  /** Phase 2B.2: append "もっと" chip + reveal LCD input when WebLLM is ready. */
  aiReady?: boolean;
  /** Inference function. When `aiReady`, the LCD input submits to this. */
  onAiInfer?: (vibe: string) => Promise<VibeInferenceResult | null>;
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
export const EffectVibeChips: React.FC<Props> = ({
  fx,
  onFxChange,
  onVibeAnnounce,
  aiReady,
  onAiInfer,
}) => {
  const animFromRef = useRef<FxState | null>(null);
  const animTargetRef = useRef<PresetEntry | null>(null);
  const animStartRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);

  // Phase 2B.2: free-form vibe input. Open state + working text + status banner.
  const [vibeInputOpen, setVibeInputOpen] = useState(false);
  const [vibeText, setVibeText] = useState('');
  const [vibeStatus, setVibeStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'thinking' }
    | { kind: 'applied'; text: string }
    | { kind: 'no-match' }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  // Apply an AI inference result the same way a chip would, minus the chip
  // highlight (no chip "owns" arbitrary user phrases). Skips the ramp-from-
  // current-position dance because we want the LLM result to feel decisive.
  const applyInferenceResult = (
    result: VibeInferenceResult,
    originalVibe: string,
  ) => {
    setActiveKeyword(null);
    onFxChange({ type: result.type as EffectType, wet: result.wet, param: result.param });
    const wetPct = Math.round(result.wet * 100);
    const paramPct = Math.round(result.param * 100);
    onVibeAnnounce?.(`${originalVibe} → ${result.type.toUpperCase()} ${wetPct}% · ${paramPct}%`);
    setVibeStatus({
      kind: 'applied',
      text: `${result.type.toUpperCase()} WET ${wetPct}% · ${paramPct}%`,
    });
  };

  const submitVibe = async () => {
    const text = vibeText.trim();
    if (!text || !onAiInfer) return;
    setVibeStatus({ kind: 'thinking' });
    try {
      const result = await onAiInfer(text);
      if (!result) {
        setVibeStatus({ kind: 'no-match' });
        return;
      }
      applyInferenceResult(result, text);
    } catch (err) {
      setVibeStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'エラーが発生しました',
      });
    }
  };

  const handleMoreChipClick = () => {
    setVibeInputOpen((open) => {
      const next = !open;
      if (next) {
        // Focus the input after the open transition lands, so the LCD caret
        // appears in place rather than mid-animation.
        setTimeout(() => inputRef.current?.focus(), 60);
      } else {
        setVibeStatus({ kind: 'idle' });
      }
      return next;
    });
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
        {aiReady && onAiInfer && (
          <button
            type="button"
            className={`effect-vibe-chip effect-vibe-chip-more ${vibeInputOpen ? 'is-active' : ''}`}
            onClick={handleMoreChipClick}
            aria-pressed={vibeInputOpen}
            aria-expanded={vibeInputOpen}
            aria-controls="vibe-input-panel"
            aria-label="他の言葉 — 自由な言葉でエフェクトを呼び出す"
          >
            他の言葉
          </button>
        )}
      </div>

      {aiReady && onAiInfer && vibeInputOpen && (
        <div className="vibe-input-panel" id="vibe-input-panel" role="region" aria-label="自由入力エフェクト">
          <div className="vibe-input-row">
            <span className="vibe-input-prompt" aria-hidden="true">▸</span>
            <input
              ref={inputRef}
              type="text"
              className="vibe-input-field"
              value={vibeText}
              onChange={(e) => setVibeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitVibe();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setVibeInputOpen(false);
                  setVibeStatus({ kind: 'idle' });
                }
              }}
              placeholder="ピヨピヨ / 水族館っぽく / 80年代風 …"
              maxLength={40}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="自由入力でエフェクトを指定"
              disabled={vibeStatus.kind === 'thinking'}
            />
            <button
              type="button"
              className="vibe-input-go"
              onClick={submitVibe}
              disabled={!vibeText.trim() || vibeStatus.kind === 'thinking'}
              aria-label="この言葉でエフェクトを生成"
            >
              {vibeStatus.kind === 'thinking' ? '…' : 'GO'}
            </button>
          </div>
          <div className={`vibe-input-status vibe-input-status--${vibeStatus.kind}`} aria-live="polite">
            {vibeStatus.kind === 'idle' && 'EnterまたはGOで適用 / Escで閉じる'}
            {vibeStatus.kind === 'thinking' && 'AIが解釈中…'}
            {vibeStatus.kind === 'applied' && `→ ${vibeStatus.text}`}
            {vibeStatus.kind === 'no-match' && '一致なし — 別の言葉でお試しください'}
            {vibeStatus.kind === 'error' && `エラー: ${vibeStatus.message}`}
          </div>
        </div>
      )}
    </div>
  );
};
