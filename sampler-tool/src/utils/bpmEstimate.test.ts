import { describe, it, expect } from 'vitest';
import { estimateBpm, buildBeatGrid } from './bpmEstimate';

/**
 * estimateBpm tests.
 *
 * The estimator does not try to track variable tempo; it gives a single best
 * BPM for the whole onset list. We test the cases that matter for Reference
 * Mode UX:
 *   - clean steady tempo → estimator hits exactly
 *   - jittered onsets → estimator still within ±2 BPM
 *   - half / double-time folds → both produce the same in-range BPM
 *   - too few / silent inputs → returns ZERO without crashing
 */

const onsetsAt = (bpm: number, durationSec: number, jitterSec = 0): number[] => {
  const interval = 60 / bpm;
  const out: number[] = [];
  for (let t = 0; t < durationSec; t += interval) {
    const j = jitterSec > 0 ? (Math.random() - 0.5) * 2 * jitterSec : 0;
    out.push(t + j);
  }
  return out.sort((a, b) => a - b);
};

describe('estimateBpm', () => {
  it('returns 0 / 0 for empty input', () => {
    expect(estimateBpm([])).toEqual({ bpm: 0, confidence: 0 });
  });

  it('returns 0 / 0 for too-few onsets (<4)', () => {
    expect(estimateBpm([0, 0.5, 1.0])).toEqual({ bpm: 0, confidence: 0 });
  });

  it('locks onto a clean 90 BPM track within 1 BPM', () => {
    const onsets = onsetsAt(90, 30);
    const e = estimateBpm(onsets);
    expect(Math.abs(e.bpm - 90)).toBeLessThanOrEqual(1);
    expect(e.confidence).toBeGreaterThan(0.05);
  });

  it('locks onto a clean 120 BPM track within 1 BPM', () => {
    const onsets = onsetsAt(120, 30);
    const e = estimateBpm(onsets);
    expect(Math.abs(e.bpm - 120)).toBeLessThanOrEqual(1);
  });

  it('locks onto a clean 75 BPM track (boom-bap) within 1 BPM', () => {
    const onsets = onsetsAt(75, 30);
    const e = estimateBpm(onsets);
    expect(Math.abs(e.bpm - 75)).toBeLessThanOrEqual(1);
  });

  it('survives ±10ms timing jitter (drum-machine slop)', () => {
    const onsets = onsetsAt(96, 30, 0.01);
    const e = estimateBpm(onsets);
    expect(Math.abs(e.bpm - 96)).toBeLessThanOrEqual(2);
  });

  it('folds 200 BPM into the in-range BPM (100)', () => {
    // 200 BPM is above MAX_BPM (180). The folder halves it → 100.
    const onsets = onsetsAt(200, 30);
    const e = estimateBpm(onsets);
    expect(e.bpm).toBeGreaterThanOrEqual(95);
    expect(e.bpm).toBeLessThanOrEqual(105);
  });

  it('folds 40 BPM into the in-range BPM (80)', () => {
    // 40 BPM is below MIN_BPM (60). The folder doubles it → 80.
    const onsets = onsetsAt(40, 60);
    const e = estimateBpm(onsets);
    expect(e.bpm).toBeGreaterThanOrEqual(75);
    expect(e.bpm).toBeLessThanOrEqual(85);
  });
});

describe('buildBeatGrid', () => {
  it('returns empty for invalid inputs', () => {
    expect(buildBeatGrid(0, 60)).toEqual([]);
    expect(buildBeatGrid(120, 0)).toEqual([]);
  });

  it('lays beats at 60/BPM second intervals starting at 0', () => {
    const grid = buildBeatGrid(120, 4);
    // 120 BPM → 0.5s per beat → grid: 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5
    expect(grid.length).toBe(8);
    expect(grid[0]).toBe(0);
    expect(grid[1]).toBeCloseTo(0.5);
    expect(grid[7]).toBeCloseTo(3.5);
  });

  it('does not extend past the duration', () => {
    const grid = buildBeatGrid(60, 3);
    // 60 BPM → 1s per beat → grid: 0, 1, 2 (3 is excluded since loop is t < dur)
    expect(grid).toEqual([0, 1, 2]);
  });

  it('honors a positive offset (intro-aware grid)', () => {
    // 120 BPM, 4s, offset 0.25s → beats at 0.25, 0.75, 1.25, 1.75, 2.25,
    // 2.75, 3.25, 3.75. The walk-backwards loop also adds nothing < 0.25
    // because 0.25 - 0.5 = -0.25 < 0.
    const grid = buildBeatGrid(120, 4, 0.25);
    expect(grid).toHaveLength(8);
    expect(grid[0]).toBeCloseTo(0.25);
    expect(grid[1]).toBeCloseTo(0.75);
    expect(grid[grid.length - 1]).toBeCloseTo(3.75);
  });

  it('walks backwards from offset to fill the head of the grid', () => {
    // 120 BPM, 4s, offset 1.0s → grid should still include 0.0 and 0.5
    // (walked backwards from 1.0 by 0.5s steps), then 1.0, 1.5, ..., 3.5
    const grid = buildBeatGrid(120, 4, 1.0);
    expect(grid).toHaveLength(8);
    expect(grid[0]).toBeCloseTo(0);
    expect(grid[1]).toBeCloseTo(0.5);
    expect(grid[2]).toBeCloseTo(1.0);
  });

  it('clamps negative offsets so first beat is always >= 0', () => {
    const grid = buildBeatGrid(120, 4, -1.25);
    // Beats at -1.25, -0.75, -0.25 are clamped out (< 0). First emitted
    // is 0.25, then 0.75, 1.25, ...
    expect(grid[0]).toBeCloseTo(0.25);
  });
});
