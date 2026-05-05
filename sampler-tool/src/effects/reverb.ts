import type { EffectNode } from './types';
import { buildWetDry } from './wetDry';

/**
 * Algorithmic reverb — generates an exponentially-decaying noise impulse
 * response and feeds it to a ConvolverNode.
 *
 * SIZE knob (0..1) maps to:
 *   - 0.0 → tight 0.5s room
 *   - 0.5 → 2s plate
 *   - 1.0 → 6s hall
 *
 * IR is regenerated when SIZE crosses thresholds — we don't morph in real time
 * since ConvolverNode swap is cheap (<10ms) and the edit is a deliberate user
 * action, not an automation curve.
 */
const buildImpulseResponse = (ctx: AudioContext, durationSec: number): AudioBuffer => {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * durationSec));
  const ir = ctx.createBuffer(2, length, sampleRate);
  const decay = 3.0; // higher = faster falloff
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // pre-delay-less white noise * exponential envelope
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return ir;
};

const sizeToDuration = (param: number): number => 0.5 + param * 5.5; // 0.5..6.0s

export const createReverb = (ctx: AudioContext): EffectNode => {
  const wetDry = buildWetDry(ctx);
  const convolver = ctx.createConvolver();
  convolver.buffer = buildImpulseResponse(ctx, sizeToDuration(0.5));

  // wet path: wetIn → convolver → wetOut
  wetDry.wetIn.connect(convolver);
  convolver.connect(wetDry.wetOut);

  let lastDuration = sizeToDuration(0.5);

  return {
    input: wetDry.input,
    output: wetDry.output,
    setWet(v) {
      wetDry.setWet(v);
    },
    setParam(v) {
      const next = sizeToDuration(v);
      // Only regen if the size moved meaningfully — avoids thrash from
      // small slider jitter.
      if (Math.abs(next - lastDuration) > 0.2) {
        convolver.buffer = buildImpulseResponse(ctx, next);
        lastDuration = next;
      }
    },
    dispose() {
      try {
        convolver.disconnect();
      } catch {
        /* ignore */
      }
      wetDry.dispose();
    },
  };
};
