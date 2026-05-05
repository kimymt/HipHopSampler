import { describe, it, expect } from 'vitest';
import { detectOnsets, buildSlicePoints } from './onsetDetect';

// Test fixture: synthesize an AudioBuffer-shaped object with N transient
// peaks at known positions. We don't need a real AudioContext.
function makeBufferWithOnsets(onsetTimesSec, durationSec = 4, sampleRate = 44100) {
  const data = new Float32Array(durationSec * sampleRate);
  for (const t of onsetTimesSec) {
    const start = Math.floor(t * sampleRate);
    // Burst of decaying noise — looks like a clap/drum hit to the detector.
    for (let i = 0; i < 4000 && start + i < data.length; i++) {
      const env = Math.exp(-i / 1500);
      data[start + i] = (Math.sin(i * 0.1) + Math.sin(i * 0.31)) * env * 0.6;
    }
  }
  return {
    duration: durationSec,
    sampleRate,
    numberOfChannels: 1,
    length: data.length,
    getChannelData: () => data,
  };
}

function makeSilentBuffer(durationSec = 4, sampleRate = 44100) {
  return {
    duration: durationSec,
    sampleRate,
    numberOfChannels: 1,
    length: durationSec * sampleRate,
    getChannelData: () => new Float32Array(durationSec * sampleRate),
  };
}

describe('detectOnsets', () => {
  it('returns empty array for a silent buffer', () => {
    expect(detectOnsets(makeSilentBuffer())).toEqual([]);
  });

  it('returns empty array for a buffer too short for analysis', () => {
    const tiny = {
      duration: 0.001,
      sampleRate: 44100,
      numberOfChannels: 1,
      length: 44,
      getChannelData: () => new Float32Array(44),
    };
    expect(detectOnsets(tiny)).toEqual([]);
  });

  it('finds 4 onsets at 0.5s / 1.5s / 2.5s / 3.5s within 100ms tolerance', () => {
    const targets = [0.5, 1.5, 2.5, 3.5];
    const result = detectOnsets(makeBufferWithOnsets(targets));

    // The detector sometimes finds attack envelopes adjacent to a peak; assert
    // that for each target, *some* detected onset is within tolerance.
    for (const target of targets) {
      const hit = result.find((t) => Math.abs(t - target) < 0.1);
      expect(hit, `no onset within 100ms of ${target}s, found: ${result.join(',')}`).toBeDefined();
    }
  });

  it('respects minSpacing — adjacent peaks within minSpacing collapse to one', () => {
    // Two onsets only 30ms apart, well below default minSpacing 80ms
    const result = detectOnsets(makeBufferWithOnsets([1.0, 1.03]));
    // Should return at most 1 onset for that cluster (could be 0 if energy is below threshold).
    const inCluster = result.filter((t) => t >= 0.95 && t <= 1.1);
    expect(inCluster.length).toBeLessThanOrEqual(1);
  });

  it('honors maxOnsets cap', () => {
    // 50 onsets every 60ms — many will be filtered by minSpacing, but the
    // remaining should still be capped at 32.
    const targets = Array.from({ length: 50 }, (_, i) => 0.1 + i * 0.06);
    const result = detectOnsets(makeBufferWithOnsets(targets, 5), { minSpacing: 0.05 });
    expect(result.length).toBeLessThanOrEqual(32);
  });

  it('honors custom relativeThreshold', () => {
    const buf = makeBufferWithOnsets([0.5, 1.5, 2.5, 3.5]);
    const strict = detectOnsets(buf, { relativeThreshold: 0.9 });
    const lenient = detectOnsets(buf, { relativeThreshold: 0.05 });
    // A higher threshold should never produce *more* onsets than a lower one.
    expect(strict.length).toBeLessThanOrEqual(lenient.length);
  });
});

describe('buildSlicePoints', () => {
  it('prepends 0 when first onset is past 40ms head', () => {
    const points = buildSlicePoints([1.0, 2.0], 3.0);
    expect(points[0]).toBe(0);
    expect(points).toEqual([0, 1.0, 2.0, 3.0]);
  });

  it('snaps first onset to 0 when it is within 40ms of the start', () => {
    const points = buildSlicePoints([0.02, 1.0], 2.0);
    expect(points[0]).toBe(0);
    // The 0.02 was snapped, so length stays 3 (start, 1.0, end).
    expect(points.length).toBe(3);
  });

  it('appends totalDuration when last onset is more than 40ms before end', () => {
    const points = buildSlicePoints([0.5, 1.0], 3.0);
    expect(points[points.length - 1]).toBe(3.0);
  });

  it('snaps last onset to totalDuration when within 40ms of end', () => {
    const points = buildSlicePoints([0.5, 2.99], 3.0);
    expect(points[points.length - 1]).toBe(3.0);
    // The 2.99 was snapped to 3.0, length stays at 3 (start, 0.5, end).
    expect(points.length).toBe(3);
  });

  it('returns [0, totalDuration] for an empty onset list', () => {
    const points = buildSlicePoints([], 2.5);
    expect(points).toEqual([0, 2.5]);
  });

  it('produces N+1 boundaries for N slices', () => {
    const points = buildSlicePoints([1.0, 2.0, 3.0], 4.0);
    expect(points.length).toBe(5); // N=4 slices
  });

  it('boundaries are in ascending order', () => {
    const points = buildSlicePoints([0.5, 1.5, 2.5], 4.0);
    for (let i = 1; i < points.length; i++) {
      expect(points[i]).toBeGreaterThan(points[i - 1]);
    }
  });
});
