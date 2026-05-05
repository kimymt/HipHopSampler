import type { EffectNode } from './types';
import { buildWetDry } from './wetDry';

/**
 * Tempo-synced feedback delay.
 *
 * TIME knob (0..1) cycles through musically meaningful subdivisions of the
 * current BPM, since "1 second delay" is meaningless without rhythmic context:
 *   0.0..0.2 → 1/16 note (fast slap)
 *   0.2..0.4 → 1/8 note
 *   0.4..0.6 → dotted 1/8
 *   0.6..0.8 → 1/4 note
 *   0.8..1.0 → dotted 1/4
 *
 * Feedback fixed at ~0.4 — enough for 3-4 audible repeats without runaway.
 *
 * The delay needs to know the BPM. Caller supplies it via setBpm().
 */
const SUBDIVISIONS = [
  { ratio: 1 / 16, label: '1/16' },
  { ratio: 1 / 8, label: '1/8' },
  { ratio: (1 / 8) * 1.5, label: '1/8.' },
  { ratio: 1 / 4, label: '1/4' },
  { ratio: (1 / 4) * 1.5, label: '1/4.' },
];

const paramToSubdivisionIdx = (v: number): number => {
  const idx = Math.min(SUBDIVISIONS.length - 1, Math.floor(v * SUBDIVISIONS.length));
  return idx;
};

export interface DelayEffect extends EffectNode {
  setBpm(bpm: number): void;
}

const computeDelaySec = (bpm: number, paramValue: number): number => {
  const beatsPerSec = bpm / 60;
  const secPerBeat = 1 / beatsPerSec;
  const sub = SUBDIVISIONS[paramToSubdivisionIdx(paramValue)];
  return secPerBeat * 4 * sub.ratio; // 4 beats = whole note
};

export const createDelay = (ctx: AudioContext, initialBpm = 90): DelayEffect => {
  const wetDry = buildWetDry(ctx);
  const delay = ctx.createDelay(2.0); // max 2 seconds — enough for 1/4 at 60bpm
  const feedback = ctx.createGain();
  feedback.gain.value = 0.4;

  // wet path: wetIn → delay → wetOut
  //                         ↘ feedback → delay (loop)
  wetDry.wetIn.connect(delay);
  delay.connect(wetDry.wetOut);
  delay.connect(feedback);
  feedback.connect(delay);

  let bpm = initialBpm;
  let paramValue = 0.5;
  delay.delayTime.value = computeDelaySec(bpm, paramValue);

  const updateDelayTime = () => {
    delay.delayTime.setTargetAtTime(computeDelaySec(bpm, paramValue), ctx.currentTime, 0.05);
  };

  return {
    input: wetDry.input,
    output: wetDry.output,
    setWet(v) {
      wetDry.setWet(v);
    },
    setParam(v) {
      paramValue = Math.max(0, Math.min(1, v));
      updateDelayTime();
    },
    setBpm(b) {
      bpm = Math.max(20, Math.min(300, b));
      updateDelayTime();
    },
    dispose() {
      try {
        delay.disconnect();
        feedback.disconnect();
      } catch {
        /* ignore */
      }
      wetDry.dispose();
    },
  };
};
