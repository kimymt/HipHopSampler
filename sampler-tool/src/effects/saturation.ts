import type { EffectNode } from './types';
import { buildWetDry } from './wetDry';

/**
 * Soft-clipping saturation via WaveShaperNode.
 *
 * DRIVE (0..1) controls how aggressive the soft-clip is:
 *   0.00 → near-linear (subtle warmth)
 *   0.50 → musical "tape" saturation
 *   1.00 → heavy fuzz, near hard clip
 *
 * The curve is a tanh-style shaping function: tanh(amount * x) / tanh(amount).
 * Normalized so the curve always reaches ±1 at x = ±1. Output is then run
 * through a -3dB makeup gain reduction so heavier drive doesn't get
 * uncomfortably loud (compensating for the natural compression of the curve).
 */
const SAMPLES = 1024;

// WaveShaperNode.curve expects Float32Array<ArrayBuffer> (not the generic
// Float32Array<ArrayBufferLike>) — building from an explicit ArrayBuffer
// keeps TypeScript happy without runtime cost.
const buildShapingCurve = (drive: number) => {
  const amount = 1 + drive * 30; // 1..31
  const curve = new Float32Array(new ArrayBuffer(SAMPLES * 4));
  const norm = Math.tanh(amount);
  for (let i = 0; i < SAMPLES; i++) {
    const x = (i * 2) / SAMPLES - 1; // -1..1
    curve[i] = Math.tanh(amount * x) / norm;
  }
  return curve;
};

export const createSaturation = (ctx: AudioContext): EffectNode => {
  const wetDry = buildWetDry(ctx);
  const shaper = ctx.createWaveShaper();
  shaper.curve = buildShapingCurve(0.5);
  shaper.oversample = '2x'; // smoother high-end, modest CPU cost

  // makeup gain so heavier drive isn't louder
  const makeup = ctx.createGain();
  makeup.gain.value = 0.7;

  wetDry.wetIn.connect(shaper);
  shaper.connect(makeup);
  makeup.connect(wetDry.wetOut);

  return {
    input: wetDry.input,
    output: wetDry.output,
    setWet(v) {
      wetDry.setWet(v);
    },
    setParam(v) {
      const drive = Math.max(0, Math.min(1, v));
      shaper.curve = buildShapingCurve(drive);
      // taper makeup as drive rises (more drive = more compression = need less attenuation)
      const m = 0.85 - drive * 0.2; // 0.85..0.65
      makeup.gain.setTargetAtTime(m, ctx.currentTime, 0.02);
    },
    dispose() {
      try {
        shaper.disconnect();
        makeup.disconnect();
      } catch {
        /* ignore */
      }
      wetDry.dispose();
    },
  };
};
