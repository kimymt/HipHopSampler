import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildWetDry } from './wetDry';
import { createReverb } from './reverb';
import { createDelay } from './delay';
import { createFilter } from './filter';
import { createSaturation } from './saturation';
import { EFFECT_META, EFFECT_TYPES, DEFAULT_FX_STATE } from './types';

/**
 * Effects tests run against the test-setup AudioContext stub. We're not
 * verifying audio output (impossible in happy-dom) — we're verifying the
 * graph wiring, parameter mapping, and lifecycle (mount, change, dispose).
 *
 * The stub is loose: createGain/createDelay/createBiquadFilter/etc. return
 * objects with the methods we touch. Where the stub doesn't cover a node
 * type (ConvolverNode, WaveShaperNode), we extend per test.
 */

const setupCtxExtras = (ctx: any) => {
  // ConvolverNode (used by reverb)
  if (!ctx.createConvolver) {
    ctx.createConvolver = vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    }));
  }
  // createBuffer (used by reverb IR)
  if (!ctx.createBuffer) {
    ctx.createBuffer = vi.fn((channels: number, length: number) => ({
      length,
      sampleRate: ctx.sampleRate ?? 44100,
      numberOfChannels: channels,
      duration: length / (ctx.sampleRate ?? 44100),
      getChannelData: () => new Float32Array(length),
    }));
  }
  // createDelay
  if (!ctx.createDelay) {
    ctx.createDelay = vi.fn(() => ({
      delayTime: { value: 0, setTargetAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }));
  }
  // createBiquadFilter
  if (!ctx.createBiquadFilter) {
    ctx.createBiquadFilter = vi.fn(() => ({
      type: 'lowpass',
      frequency: { value: 0, setTargetAtTime: vi.fn() },
      Q: { value: 0 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }));
  }
  // createWaveShaper
  if (!ctx.createWaveShaper) {
    ctx.createWaveShaper = vi.fn(() => ({
      curve: null,
      oversample: 'none',
      connect: vi.fn(),
      disconnect: vi.fn(),
    }));
  }
  // createGain refinement: ensure setTargetAtTime exists on .gain
  const origCreateGain = ctx.createGain.bind(ctx);
  ctx.createGain = vi.fn(() => {
    const node: any = origCreateGain();
    if (!node.gain.setTargetAtTime) {
      node.gain.setTargetAtTime = vi.fn();
    }
    if (!node.connect) node.connect = vi.fn();
    if (!node.disconnect) node.disconnect = vi.fn();
    return node;
  });
};

let ctx: any;
beforeEach(() => {
  ctx = new (globalThis as any).AudioContext();
  setupCtxExtras(ctx);
});

describe('EFFECT_META', () => {
  it('has metadata for every effect type', () => {
    for (const type of EFFECT_TYPES) {
      expect(EFFECT_META[type]).toBeDefined();
      expect(EFFECT_META[type].label).toBeTruthy();
    }
  });

  it('DEFAULT_FX_STATE is none with mid wet/param', () => {
    expect(DEFAULT_FX_STATE.type).toBe('none');
    expect(DEFAULT_FX_STATE.wet).toBeGreaterThan(0);
    expect(DEFAULT_FX_STATE.wet).toBeLessThanOrEqual(1);
    expect(DEFAULT_FX_STATE.param).toBeGreaterThan(0);
    expect(DEFAULT_FX_STATE.param).toBeLessThanOrEqual(1);
  });
});

describe('buildWetDry', () => {
  it('exposes input, output, wetIn, wetOut, setWet, dispose', () => {
    const g = buildWetDry(ctx);
    expect(g.input).toBeDefined();
    expect(g.output).toBeDefined();
    expect(g.wetIn).toBeDefined();
    expect(g.wetOut).toBeDefined();
    expect(typeof g.setWet).toBe('function');
    expect(typeof g.dispose).toBe('function');
  });

  it('clamps wet to 0..1', () => {
    const g = buildWetDry(ctx);
    // Should not throw on out-of-range values
    expect(() => g.setWet(-0.5)).not.toThrow();
    expect(() => g.setWet(1.5)).not.toThrow();
  });

  it('dispose disconnects without throwing', () => {
    const g = buildWetDry(ctx);
    expect(() => g.dispose()).not.toThrow();
    // dispose is idempotent
    expect(() => g.dispose()).not.toThrow();
  });
});

describe('createReverb', () => {
  it('returns a node with input, output, setWet, setParam, dispose', () => {
    const r = createReverb(ctx);
    expect(r.input).toBeDefined();
    expect(r.output).toBeDefined();
    expect(typeof r.setWet).toBe('function');
    expect(typeof r.setParam).toBe('function');
    expect(typeof r.dispose).toBe('function');
  });

  it('setParam regenerates IR when size moves significantly', () => {
    const r = createReverb(ctx);
    const callsBefore = ctx.createBuffer.mock.calls.length;
    r.setParam(0.0); // big drop from default 0.5
    const callsAfter = ctx.createBuffer.mock.calls.length;
    expect(callsAfter).toBeGreaterThan(callsBefore);
  });

  it('setParam does NOT regenerate IR for tiny changes', () => {
    const r = createReverb(ctx);
    const callsBefore = ctx.createBuffer.mock.calls.length;
    r.setParam(0.51); // tiny nudge from default 0.5
    const callsAfter = ctx.createBuffer.mock.calls.length;
    expect(callsAfter).toBe(callsBefore);
  });
});

describe('createDelay', () => {
  // Helper: pull out the most-recently-set delay time from setTargetAtTime calls.
  const lastDelaySec = (delayNode: any): number => {
    const calls = delayNode.delayTime.setTargetAtTime.mock.calls;
    return calls.length ? calls[calls.length - 1][0] : delayNode.delayTime.value;
  };

  it('exposes setBpm in addition to standard EffectNode methods', () => {
    const d = createDelay(ctx, 90);
    expect(typeof d.setBpm).toBe('function');
    expect(typeof d.setParam).toBe('function');
  });

  it('setParam updates the underlying delay time', () => {
    const d = createDelay(ctx, 120);
    const delayCalls = ctx.createDelay.mock.results;
    const delayNode = delayCalls[delayCalls.length - 1].value;
    const callsBefore = delayNode.delayTime.setTargetAtTime.mock.calls.length;
    d.setParam(0.9);
    expect(delayNode.delayTime.setTargetAtTime.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('setBpm clamps to a sane range', () => {
    const d = createDelay(ctx, 90);
    expect(() => d.setBpm(-100)).not.toThrow();
    expect(() => d.setBpm(99999)).not.toThrow();
  });

  // ── BPM-sync correctness ──────────────────────────────────────────────
  // The delay must produce delay-time values that match musical
  // subdivisions of the current BPM. Whole note = 4 beats, so each
  // subdivision (1/16, 1/8, 1/8., 1/4, 1/4.) maps to:
  //   delaySec = (60 / bpm) * 4 * subdivision_ratio

  it('BPM 120, TIME=0 → 1/16 subdivision = 125ms', () => {
    const d = createDelay(ctx, 120);
    const delayNode = ctx.createDelay.mock.results.at(-1).value;
    d.setParam(0.0);
    expect(lastDelaySec(delayNode)).toBeCloseTo(0.125, 4);
  });

  it('BPM 120, TIME=0.3 → 1/8 = 250ms', () => {
    const d = createDelay(ctx, 120);
    const delayNode = ctx.createDelay.mock.results.at(-1).value;
    d.setParam(0.3);
    expect(lastDelaySec(delayNode)).toBeCloseTo(0.25, 4);
  });

  it('BPM 120, TIME=0.5 → 1/8 dotted = 375ms', () => {
    const d = createDelay(ctx, 120);
    const delayNode = ctx.createDelay.mock.results.at(-1).value;
    d.setParam(0.5);
    expect(lastDelaySec(delayNode)).toBeCloseTo(0.375, 4);
  });

  it('BPM 120, TIME=0.7 → 1/4 = 500ms', () => {
    const d = createDelay(ctx, 120);
    const delayNode = ctx.createDelay.mock.results.at(-1).value;
    d.setParam(0.7);
    expect(lastDelaySec(delayNode)).toBeCloseTo(0.5, 4);
  });

  it('BPM 120, TIME=0.95 → 1/4 dotted = 750ms', () => {
    const d = createDelay(ctx, 120);
    const delayNode = ctx.createDelay.mock.results.at(-1).value;
    d.setParam(0.95);
    expect(lastDelaySec(delayNode)).toBeCloseTo(0.75, 4);
  });

  it('halving BPM doubles the delay time at the same TIME setting', () => {
    const d = createDelay(ctx, 120);
    const delayNode = ctx.createDelay.mock.results.at(-1).value;
    d.setParam(0.7); // 1/4 note
    const at120 = lastDelaySec(delayNode); // 0.5s
    d.setBpm(60);
    const at60 = lastDelaySec(delayNode); // expected 1.0s
    expect(at60).toBeCloseTo(at120 * 2, 4);
    expect(at60).toBeCloseTo(1.0, 4);
  });

  it('doubling BPM halves the delay time at the same TIME setting', () => {
    const d = createDelay(ctx, 90);
    const delayNode = ctx.createDelay.mock.results.at(-1).value;
    d.setParam(0.5); // 1/8 dotted
    const at90 = lastDelaySec(delayNode); // (60/90)*4*(0.1875) = 0.5
    d.setBpm(180);
    const at180 = lastDelaySec(delayNode); // 0.25
    expect(at180).toBeCloseTo(at90 / 2, 4);
    expect(at180).toBeCloseTo(0.25, 4);
  });

  it('BPM 60 + TIME=0.7 (1/4) → exactly 1 second', () => {
    const d = createDelay(ctx, 60);
    const delayNode = ctx.createDelay.mock.results.at(-1).value;
    d.setParam(0.7);
    expect(lastDelaySec(delayNode)).toBeCloseTo(1.0, 4);
  });

  it('all subdivisions stay within DelayNode max time (2 seconds)', () => {
    // Slowest case: 1/4 dotted at the lowest sane BPM (60) =
    //   (60/60) * 4 * 0.375 = 1.5s. Must be < 2s ceiling.
    const d = createDelay(ctx, 60);
    const delayNode = ctx.createDelay.mock.results.at(-1).value;
    d.setParam(1.0);
    expect(lastDelaySec(delayNode)).toBeLessThan(2.0);
  });
});

describe('createFilter', () => {
  it('switches mode at the 0.5 crossover', () => {
    const f = createFilter(ctx);
    const filterNode = ctx.createBiquadFilter.mock.results[0].value;

    f.setParam(0.3); // low side → lowpass
    expect(filterNode.type).toBe('lowpass');

    f.setParam(0.8); // high side → highpass
    expect(filterNode.type).toBe('highpass');
  });

  it('clamps param to 0..1', () => {
    const f = createFilter(ctx);
    expect(() => f.setParam(-0.5)).not.toThrow();
    expect(() => f.setParam(1.5)).not.toThrow();
  });
});

describe('createSaturation', () => {
  it('builds a shaping curve when constructed', () => {
    const s = createSaturation(ctx);
    const shaperNode = ctx.createWaveShaper.mock.results[0].value;
    expect(shaperNode.curve).toBeDefined();
    expect(shaperNode.curve.length).toBeGreaterThan(0);
    expect(shaperNode.oversample).toBe('2x');
    s.dispose();
  });

  it('rebuilds the curve on setParam', () => {
    const s = createSaturation(ctx);
    const shaperNode = ctx.createWaveShaper.mock.results[0].value;
    const before = shaperNode.curve;
    s.setParam(0.9);
    expect(shaperNode.curve).not.toBe(before);
  });
});
