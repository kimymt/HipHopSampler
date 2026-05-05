import type { EffectNode } from './types';
import { buildWetDry } from './wetDry';

/**
 * Lo-fi: BitCrusher AudioWorklet + cassette-style low-pass.
 *
 * CRUSH (0..1) controls:
 *   - bit depth: 16 → 4
 *   - sample-rate reduction: 1 → 12
 *   - low-pass cutoff: 8000 Hz → 2000 Hz
 *
 * One knob drives all three so the user just feels "more lo-fi" as they
 * crank it without juggling 3 parameters.
 *
 * AudioWorklet module must be added to the AudioContext before this is
 * created. We do that lazily — the module is loaded once per context, and
 * subsequent createLofi() calls are synchronous if the module is already
 * registered.
 */
let workletPromise: Promise<void> | null = null;

const ensureWorkletLoaded = (ctx: AudioContext): Promise<void> => {
  if (!workletPromise) {
    workletPromise = ctx.audioWorklet.addModule('/bitcrusher-worklet.js');
  }
  return workletPromise;
};

const paramToBits = (v: number): number => {
  // 16 → 4 as v goes 0 → 1
  return Math.round(16 - v * 12);
};

const paramToReduction = (v: number): number => {
  // 1 → 12 as v goes 0 → 1
  return Math.round(1 + v * 11);
};

const paramToCutoff = (v: number): number => {
  // 8000 → 2000 Hz as v goes 0 → 1 (log scale)
  return 8000 * Math.pow(2000 / 8000, v);
};

export const createLofi = async (ctx: AudioContext): Promise<EffectNode> => {
  await ensureWorkletLoaded(ctx);

  const wetDry = buildWetDry(ctx);
  const crusher = new AudioWorkletNode(ctx, 'bitcrusher');
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = paramToCutoff(0.5);
  filter.Q.value = 0.5;

  const setBits = (b: number) => {
    const param = crusher.parameters.get('bits');
    param?.setTargetAtTime(b, ctx.currentTime, 0.01);
  };
  const setReduction = (r: number) => {
    const param = crusher.parameters.get('reduction');
    param?.setTargetAtTime(r, ctx.currentTime, 0.01);
  };

  setBits(paramToBits(0.5));
  setReduction(paramToReduction(0.5));

  // wet path: wetIn → crusher → filter → wetOut
  wetDry.wetIn.connect(crusher);
  crusher.connect(filter);
  filter.connect(wetDry.wetOut);

  return {
    input: wetDry.input,
    output: wetDry.output,
    setWet(v) {
      wetDry.setWet(v);
    },
    setParam(v) {
      const clamped = Math.max(0, Math.min(1, v));
      setBits(paramToBits(clamped));
      setReduction(paramToReduction(clamped));
      filter.frequency.setTargetAtTime(paramToCutoff(clamped), ctx.currentTime, 0.02);
    },
    dispose() {
      try {
        crusher.disconnect();
        filter.disconnect();
      } catch {
        /* ignore */
      }
      wetDry.dispose();
    },
  };
};
