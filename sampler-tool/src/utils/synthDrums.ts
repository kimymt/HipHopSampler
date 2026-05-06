/**
 * Phase 2C: Synthesized starter kit.
 *
 * Eight Web Audio synthesis recipes for the basic hip-hop drum kit. Generated
 * via OfflineAudioContext so we can render to AudioBuffer without playback,
 * then encoded to WAV Blob and pushed through the same loadSample pipeline
 * as user-uploaded files (so persistence + waveform display work identically).
 *
 * Why we synthesize instead of bundling sample files:
 *   - License: zero risk, all generated client-side
 *   - Bundle size: ~2KB code vs ~5MB of WAV files
 *   - Editability: param tweaks are one-line code edits, not file re-records
 *   - Effect-chip synergy: synth drums sound clean by default, which means
 *     the lofi/saturation/reverb chips have maximum visible impact when the
 *     user applies them. Applying テープ to a synth kick → instant boom-bap.
 *
 * Recipes are conservative — these are well-known DSP starting points, not
 * unique signature sounds. Users layer effects on top to taste.
 */

import { encodeWav } from './wavEncode';

export interface StarterSample {
  name: string;
  blob: Blob;
}

/** Render an OfflineAudioContext setup function to a WAV-encoded Blob. */
const renderToWav = async (
  durationSec: number,
  sampleRate: number,
  setup: (ctx: OfflineAudioContext) => void,
): Promise<Blob> => {
  const length = Math.max(1, Math.floor(durationSec * sampleRate));
  const ctx = new OfflineAudioContext(1, length, sampleRate);
  setup(ctx);
  const buffer = await ctx.startRendering();
  return encodeWav(buffer);
};

// Tiny helper: `now` is implicit 0 in offline rendering. AudioParam ramps
// must end strictly above 0 for exponentialRampToValueAtTime — we floor at
// 0.0001 to avoid silent NaN traps that some browsers throw.
const SILENCE = 0.0001;

// ── Kick (boom-bap, ~400ms) ───────────────────────────────────────
// Sine drop from 150Hz → 50Hz over 100ms gives the "thump" character;
// short noise transient on top adds the click that distinguishes a kick
// from a sub bass.
const synthKick = (sampleRate: number) =>
  renderToWav(0.4, sampleRate, (ctx) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, 0);
    osc.frequency.exponentialRampToValueAtTime(50, 0.1);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0, 0);
    oscGain.gain.linearRampToValueAtTime(1, 0.002);
    oscGain.gain.exponentialRampToValueAtTime(SILENCE, 0.4);
    osc.connect(oscGain).connect(ctx.destination);

    // Click transient — short noise burst
    const click = ctx.createBufferSource();
    const clickBuf = ctx.createBuffer(1, Math.floor(sampleRate * 0.01), sampleRate);
    const cd = clickBuf.getChannelData(0);
    for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * (1 - i / cd.length);
    click.buffer = clickBuf;
    const clickGain = ctx.createGain();
    clickGain.gain.value = 0.3;
    click.connect(clickGain).connect(ctx.destination);

    osc.start(0);
    osc.stop(0.4);
    click.start(0);
  });

// ── Snare (~200ms) ────────────────────────────────────────────────
// Tonal body (triangle ~220Hz quick decay) + filtered noise (high-pass)
// for the snares-rattling component.
const synthSnare = (sampleRate: number) =>
  renderToWav(0.25, sampleRate, (ctx) => {
    // Tonal body
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 220;
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.7, 0);
    oscGain.gain.exponentialRampToValueAtTime(SILENCE, 0.12);
    osc.connect(oscGain).connect(ctx.destination);

    // Noise component
    const noise = ctx.createBufferSource();
    const nb = ctx.createBuffer(1, Math.floor(sampleRate * 0.25), sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    noise.buffer = nb;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1800;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6, 0);
    noiseGain.gain.exponentialRampToValueAtTime(SILENCE, 0.18);
    noise.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);

    osc.start(0);
    osc.stop(0.25);
    noise.start(0);
  });

// ── Closed Hi-Hat (~30ms) ─────────────────────────────────────────
const synthClosedHat = (sampleRate: number) =>
  renderToWav(0.06, sampleRate, (ctx) => {
    const noise = ctx.createBufferSource();
    const nb = ctx.createBuffer(1, Math.floor(sampleRate * 0.06), sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    noise.buffer = nb;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 8000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, 0);
    gain.gain.exponentialRampToValueAtTime(SILENCE, 0.04);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(0);
  });

// ── Open Hi-Hat (~250ms) ──────────────────────────────────────────
const synthOpenHat = (sampleRate: number) =>
  renderToWav(0.3, sampleRate, (ctx) => {
    const noise = ctx.createBufferSource();
    const nb = ctx.createBuffer(1, Math.floor(sampleRate * 0.3), sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    noise.buffer = nb;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.45, 0);
    gain.gain.exponentialRampToValueAtTime(SILENCE, 0.28);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(0);
  });

// ── Clap (~150ms) ─────────────────────────────────────────────────
// Three rapid noise bursts ~10ms apart simulate the multi-mic clap stack
// from drum machines. Band-pass around 1-2kHz keeps it band-limited.
const synthClap = (sampleRate: number) =>
  renderToWav(0.18, sampleRate, (ctx) => {
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1500;
    filter.Q.value = 1.5;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.7;
    filter.connect(masterGain).connect(ctx.destination);

    for (let i = 0; i < 4; i++) {
      const noise = ctx.createBufferSource();
      const nb = ctx.createBuffer(1, Math.floor(sampleRate * 0.04), sampleRate);
      const nd = nb.getChannelData(0);
      for (let j = 0; j < nd.length; j++) nd[j] = Math.random() * 2 - 1;
      noise.buffer = nb;
      const g = ctx.createGain();
      const startT = i * 0.011;
      // Last burst (i=3) is the loudest sustained "tail".
      const decay = i === 3 ? 0.12 : 0.025;
      g.gain.setValueAtTime(0, startT);
      g.gain.linearRampToValueAtTime(1, startT + 0.001);
      g.gain.exponentialRampToValueAtTime(SILENCE, startT + decay);
      noise.connect(g).connect(filter);
      noise.start(startT);
    }
  });

// ── 808 (~700ms) ──────────────────────────────────────────────────
// Sub-bass with pitch glide. Long sustain. The defining trap-era kick.
const synth808 = (sampleRate: number) =>
  renderToWav(0.7, sampleRate, (ctx) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(85, 0);
    osc.frequency.exponentialRampToValueAtTime(45, 0.05);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(0.95, 0.01);
    gain.gain.exponentialRampToValueAtTime(SILENCE, 0.7);
    osc.connect(gain).connect(ctx.destination);
    osc.start(0);
    osc.stop(0.7);
  });

// ── Rim (~50ms) ───────────────────────────────────────────────────
// Sharp wood-knock — band-passed noise + tiny pitched component.
const synthRim = (sampleRate: number) =>
  renderToWav(0.08, sampleRate, (ctx) => {
    const noise = ctx.createBufferSource();
    const nb = ctx.createBuffer(1, Math.floor(sampleRate * 0.08), sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    noise.buffer = nb;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1700;
    filter.Q.value = 6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, 0);
    gain.gain.exponentialRampToValueAtTime(SILENCE, 0.05);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(0);

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 600;
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.3, 0);
    oscGain.gain.exponentialRampToValueAtTime(SILENCE, 0.02);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(0);
    osc.stop(0.05);
  });

// ── Perc (cowbell/conga, ~150ms) ──────────────────────────────────
// Two-tone metallic ping. Higher-pitched percussion fill for the kit.
const synthPerc = (sampleRate: number) =>
  renderToWav(0.18, sampleRate, (ctx) => {
    const o1 = ctx.createOscillator();
    o1.type = 'square';
    o1.frequency.value = 800;
    const o2 = ctx.createOscillator();
    o2.type = 'square';
    o2.frequency.value = 540;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(0.45, 0.002);
    gain.gain.exponentialRampToValueAtTime(SILENCE, 0.15);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 700;
    filter.Q.value = 4;

    o1.connect(filter);
    o2.connect(filter);
    filter.connect(gain).connect(ctx.destination);
    o1.start(0);
    o1.stop(0.18);
    o2.start(0);
    o2.stop(0.18);
  });

/**
 * Build the 8-pad starter kit. Returns sample blobs in pad order: kick →
 * snare → closed hat → open hat → clap → 808 → rim → perc. Designed for
 * loading into pads 0-0 through 1-3 (the first two rows of the 4×4 grid).
 *
 * Each synth function uses the supplied sample rate so the resulting WAV
 * matches the user's AudioContext rate exactly — no resampling on decode.
 */
export const buildStarterKit = async (sampleRate: number): Promise<StarterSample[]> => {
  const [kick, snare, chh, ohh, clap, eight, rim, perc] = await Promise.all([
    synthKick(sampleRate),
    synthSnare(sampleRate),
    synthClosedHat(sampleRate),
    synthOpenHat(sampleRate),
    synthClap(sampleRate),
    synth808(sampleRate),
    synthRim(sampleRate),
    synthPerc(sampleRate),
  ]);
  return [
    { name: 'starter-01-kick.wav', blob: kick },
    { name: 'starter-02-snare.wav', blob: snare },
    { name: 'starter-03-hihat-closed.wav', blob: chh },
    { name: 'starter-04-hihat-open.wav', blob: ohh },
    { name: 'starter-05-clap.wav', blob: clap },
    { name: 'starter-06-808.wav', blob: eight },
    { name: 'starter-07-rim.wav', blob: rim },
    { name: 'starter-08-perc.wav', blob: perc },
  ];
};
