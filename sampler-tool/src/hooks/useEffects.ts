import { useCallback, useEffect, useRef } from 'react';
import { createReverb } from '../effects/reverb';
import { createDelay, type DelayEffect } from '../effects/delay';
import { createFilter } from '../effects/filter';
import { createSaturation } from '../effects/saturation';
import { createLofi } from '../effects/lofi';
import type { EffectNode, EffectType, FxState } from '../effects/types';

type InitAudioContext = (() => AudioContext | null) | undefined;

interface UseEffectsArgs {
  initAudioContext: InitAudioContext;
  fx: FxState;
  bpm: number;
  bypass: boolean;
}

/**
 * Master FX bus.
 *
 * Routing:
 *   per-pad source → per-pad gain/panner → masterInput ──┬──→ destination
 *                                                         (when bypassed or
 *                                                         type === 'none')
 *                                          ──→ effect.input → effect.output ──→ destination
 *                                                         (when active)
 *
 * The hook returns:
 *   - getMasterInput(): the AudioNode that useAudioEngine connects to
 *     instead of ctx.destination. This is stable across re-renders so
 *     existing playing sources stay routed correctly.
 *
 * Effect lifecycle: when fx.type changes, we tear down the old effect
 * (disconnect + dispose), build the new one, and re-route. wet/param/bpm
 * updates patch the existing node tree without rebuild.
 */
export const useEffects = ({ initAudioContext, fx, bpm, bypass }: UseEffectsArgs) => {
  const masterInputRef = useRef<GainNode | null>(null);
  const currentEffectRef = useRef<EffectNode | null>(null);
  const currentTypeRef = useRef<EffectType>('none');

  // Lazily build the master input node when audio context first comes online.
  const getMasterInput = useCallback((): AudioNode | null => {
    const ctx = initAudioContext?.();
    if (!ctx) return null;
    if (!masterInputRef.current) {
      masterInputRef.current = ctx.createGain();
      // Default: route directly to destination (no effect mounted yet)
      masterInputRef.current.connect(ctx.destination);
    }
    return masterInputRef.current;
  }, [initAudioContext]);

  // Mount/unmount the active effect when fx.type or bypass changes.
  useEffect(() => {
    const ctx = initAudioContext?.();
    if (!ctx) return;
    const masterInput = getMasterInput();
    if (!masterInput) return;

    const targetType: EffectType = bypass ? 'none' : fx.type;

    if (targetType === currentTypeRef.current) return; // no change

    // Tear down current routing
    try {
      masterInput.disconnect();
    } catch {
      /* already disconnected */
    }
    if (currentEffectRef.current) {
      currentEffectRef.current.dispose();
      currentEffectRef.current = null;
    }

    if (targetType === 'none') {
      masterInput.connect(ctx.destination);
      currentTypeRef.current = 'none';
      return;
    }

    // Build the new effect (delay & lofi creators differ in sync/async)
    let cancelled = false;
    const mount = async () => {
      let effect: EffectNode;
      switch (targetType) {
        case 'reverb':
          effect = createReverb(ctx);
          break;
        case 'delay': {
          const d = createDelay(ctx, bpm);
          effect = d;
          break;
        }
        case 'filter':
          effect = createFilter(ctx);
          break;
        case 'saturation':
          effect = createSaturation(ctx);
          break;
        case 'lofi':
          effect = await createLofi(ctx);
          break;
        default:
          effect = createReverb(ctx); // unreachable, satisfies exhaustiveness
      }
      if (cancelled) {
        effect.dispose();
        return;
      }
      effect.setWet(fx.wet);
      effect.setParam(fx.param);
      masterInput.connect(effect.input);
      effect.output.connect(ctx.destination);
      currentEffectRef.current = effect;
      currentTypeRef.current = targetType;
    };

    mount().catch((err) => {
      console.error('[useEffects] mount failed:', err);
      // Fall back to dry route so audio doesn't disappear
      try {
        masterInput.connect(ctx.destination);
      } catch {
        /* ignore */
      }
      currentTypeRef.current = 'none';
    });

    return () => {
      cancelled = true;
    };
  }, [fx.type, bypass, initAudioContext, getMasterInput, bpm, fx.wet, fx.param]);

  // wet/param updates: patch live without rebuild
  useEffect(() => {
    if (!currentEffectRef.current) return;
    currentEffectRef.current.setWet(fx.wet);
  }, [fx.wet]);

  useEffect(() => {
    if (!currentEffectRef.current) return;
    currentEffectRef.current.setParam(fx.param);
  }, [fx.param]);

  // BPM updates only affect tempo-synced effects
  useEffect(() => {
    if (currentEffectRef.current && currentTypeRef.current === 'delay') {
      (currentEffectRef.current as DelayEffect).setBpm(bpm);
    }
  }, [bpm]);

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      currentEffectRef.current?.dispose();
      currentEffectRef.current = null;
      try {
        masterInputRef.current?.disconnect();
      } catch {
        /* ignore */
      }
      masterInputRef.current = null;
    };
  }, []);

  return { getMasterInput };
};
