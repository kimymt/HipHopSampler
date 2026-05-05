import { describe, it, expect } from 'vitest';
import { getAudioLatency, PROJECT_LATENCY_TARGET_MS } from './audioLatency';

function makeCtx(opts: { baseLatency?: number; outputLatency?: number; sampleRate?: number }) {
  return {
    baseLatency: opts.baseLatency,
    outputLatency: opts.outputLatency,
    sampleRate: opts.sampleRate ?? 44100,
  } as unknown as AudioContext;
}

describe('getAudioLatency', () => {
  it('returns null when no context is provided', () => {
    expect(getAudioLatency(null)).toBeNull();
  });

  it('reports latency in milliseconds', () => {
    const r = getAudioLatency(makeCtx({ baseLatency: 0.005, outputLatency: 0.020 }))!;
    expect(r.baseLatencyMs).toBeCloseTo(5);
    expect(r.outputLatencyMs).toBeCloseTo(20);
    expect(r.totalLatencyMs).toBeCloseTo(25);
  });

  it('passes through the context sample rate', () => {
    const r = getAudioLatency(makeCtx({ baseLatency: 0.005, outputLatency: 0.020, sampleRate: 48000 }))!;
    expect(r.sampleRate).toBe(48000);
  });

  it('classifies <= 25ms as excellent', () => {
    expect(
      getAudioLatency(makeCtx({ baseLatency: 0.005, outputLatency: 0.020 }))!.classification,
    ).toBe('excellent');
    expect(
      getAudioLatency(makeCtx({ baseLatency: 0.005, outputLatency: 0.020 }))!.classification,
    ).toBe('excellent');
  });

  it('classifies > 25ms and <= 50ms as good', () => {
    expect(
      getAudioLatency(makeCtx({ baseLatency: 0.010, outputLatency: 0.030 }))!.classification,
    ).toBe('good');
  });

  it('classifies > 50ms and <= 100ms as acceptable', () => {
    expect(
      getAudioLatency(makeCtx({ baseLatency: 0.020, outputLatency: 0.060 }))!.classification,
    ).toBe('acceptable');
  });

  it('classifies > 100ms as poor (fails project target)', () => {
    expect(
      getAudioLatency(makeCtx({ baseLatency: 0.025, outputLatency: 0.100 }))!.classification,
    ).toBe('poor');
  });

  it('treats undefined latency properties as 0', () => {
    const r = getAudioLatency(makeCtx({}))!;
    expect(r.baseLatencyMs).toBe(0);
    expect(r.outputLatencyMs).toBe(0);
    expect(r.totalLatencyMs).toBe(0);
    expect(r.fullySupported).toBe(false);
  });

  it('flags fullySupported only when both values are > 0', () => {
    expect(
      getAudioLatency(makeCtx({ baseLatency: 0.005, outputLatency: 0 }))!.fullySupported,
    ).toBe(false);
    expect(
      getAudioLatency(makeCtx({ baseLatency: 0, outputLatency: 0.020 }))!.fullySupported,
    ).toBe(false);
    expect(
      getAudioLatency(makeCtx({ baseLatency: 0.005, outputLatency: 0.020 }))!.fullySupported,
    ).toBe(true);
  });

  it('PROJECT_LATENCY_TARGET_MS is 100ms (matches the project goal)', () => {
    expect(PROJECT_LATENCY_TARGET_MS).toBe(100);
  });
});
