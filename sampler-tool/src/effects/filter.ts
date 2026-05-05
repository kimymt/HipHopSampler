import type { EffectNode } from './types';
import { buildWetDry } from './wetDry';

/**
 * Bipolar filter: CUTOFF (0..1) sweeps from "deep low-pass" to "extreme high-pass"
 * through a neutral mid-point.
 *
 *   0.00 → 80 Hz LP (everything muffled — the Hip Hop "underwater" / mute fill)
 *   0.50 → 1 kHz LP (subtle warmth)
 *   1.00 → 5 kHz HP (telephone / radio voice)
 *
 * One knob, two filter modes — implemented by routing to either an LP or HP
 * BiquadFilterNode based on the param value. Wet is the standard dry/wet
 * crossfade, useful for blending the filtered signal with the dry one.
 */
const FILTER_CROSSOVER = 0.5;

const paramToLpFreq = (v: number): number => {
  // log scale 80 Hz .. 5000 Hz across [0, 0.5]
  const norm = v / FILTER_CROSSOVER;
  return 80 * Math.pow(5000 / 80, norm);
};

const paramToHpFreq = (v: number): number => {
  // log scale 100 Hz .. 5000 Hz across [0.5, 1.0]
  const norm = (v - FILTER_CROSSOVER) / FILTER_CROSSOVER;
  return 100 * Math.pow(5000 / 100, norm);
};

export const createFilter = (ctx: AudioContext): EffectNode => {
  const wetDry = buildWetDry(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = paramToLpFreq(0.5);
  filter.Q.value = 0.7;

  wetDry.wetIn.connect(filter);
  filter.connect(wetDry.wetOut);

  return {
    input: wetDry.input,
    output: wetDry.output,
    setWet(v) {
      wetDry.setWet(v);
    },
    setParam(v) {
      const clamped = Math.max(0, Math.min(1, v));
      if (clamped < FILTER_CROSSOVER) {
        filter.type = 'lowpass';
        filter.frequency.setTargetAtTime(paramToLpFreq(clamped), ctx.currentTime, 0.02);
      } else {
        filter.type = 'highpass';
        filter.frequency.setTargetAtTime(paramToHpFreq(clamped), ctx.currentTime, 0.02);
      }
    },
    dispose() {
      try {
        filter.disconnect();
      } catch {
        /* ignore */
      }
      wetDry.dispose();
    },
  };
};
