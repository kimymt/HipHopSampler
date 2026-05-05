/**
 * Wet/dry crossfade graph used by every effect.
 *
 * Signal layout:
 *   input ──┬─→ dryGain ───┐
 *           │              ├─→ output
 *           └─→ wetIn  ... ┘
 *                 (insert effect chain between wetIn and wetOut by callers)
 *           wetOut ──→ wetGain ──↑
 *
 * Equal-power crossfade:
 *   - dryGain = cos(wet * π/2)
 *   - wetGain = sin(wet * π/2)
 * keeps perceived loudness ~constant as the user sweeps wet from 0 to 1.
 */
export interface WetDryGraph {
  input: GainNode;
  output: GainNode;
  wetIn: GainNode;
  wetOut: GainNode;
  setWet(v: number): void;
  dispose(): void;
}

export const buildWetDry = (ctx: AudioContext): WetDryGraph => {
  const input = ctx.createGain();
  const dryGain = ctx.createGain();
  const wetIn = ctx.createGain();
  const wetOut = ctx.createGain();
  const wetGain = ctx.createGain();
  const output = ctx.createGain();

  input.connect(dryGain);
  input.connect(wetIn);
  wetOut.connect(wetGain);

  dryGain.connect(output);
  wetGain.connect(output);

  // sensible default — full dry, audible-but-not-flooded wet at midpoint
  dryGain.gain.value = 1;
  wetGain.gain.value = 0;

  const setWet = (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    const half = (Math.PI / 2) * clamped;
    dryGain.gain.setTargetAtTime(Math.cos(half), ctx.currentTime, 0.01);
    wetGain.gain.setTargetAtTime(Math.sin(half), ctx.currentTime, 0.01);
  };

  const dispose = () => {
    [input, dryGain, wetIn, wetOut, wetGain, output].forEach((n) => {
      try {
        n.disconnect();
      } catch {
        /* already disconnected */
      }
    });
  };

  return { input, output, wetIn, wetOut, setWet, dispose };
};
