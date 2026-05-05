import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSequencer } from './useSequencer';

// Fake AudioContext that we can advance manually so the lookahead scheduler
// has deterministic time progression.
function makeFakeContext() {
  return {
    currentTime: 0,
    advanceBy(ms) {
      this.currentTime += ms / 1000;
    },
  };
}

describe('useSequencer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not start scheduling when isPlaying is false', () => {
    const trigger = vi.fn();
    const ctx = makeFakeContext();
    renderHook(() =>
      useSequencer({
        audioContext: ctx,
        samples: {},
        patterns: { '0-0': [true, ...Array(15).fill(false)] },
        bpm: 120,
        isPlaying: false,
        onStepChange: vi.fn(),
        trigger,
      }),
    );
    vi.advanceTimersByTime(500);
    expect(trigger).not.toHaveBeenCalled();
  });

  it('does not start scheduling when audioContext is null', () => {
    const trigger = vi.fn();
    renderHook(() =>
      useSequencer({
        audioContext: null,
        samples: {},
        patterns: { '0-0': [true, ...Array(15).fill(false)] },
        bpm: 120,
        isPlaying: true,
        onStepChange: vi.fn(),
        trigger,
      }),
    );
    vi.advanceTimersByTime(500);
    expect(trigger).not.toHaveBeenCalled();
  });

  it('triggers samples on active steps when scheduling fires', () => {
    const trigger = vi.fn();
    const onStepChange = vi.fn();
    const ctx = makeFakeContext();
    const sample = { buffer: { duration: 0.5 } };
    const samples = { '0-0': sample };
    // Pattern: hits on step 0 and step 2
    const pattern = [true, false, true, ...Array(13).fill(false)];

    renderHook(() =>
      useSequencer({
        audioContext: ctx,
        samples,
        patterns: { '0-0': pattern },
        bpm: 120, // step duration = 60/120/4 = 0.125s
        isPlaying: true,
        onStepChange,
        trigger,
      }),
    );

    // Drive the lookahead loop forward — the scheduler runs every 25ms and
    // schedules anything within `currentTime + SCHEDULE_AHEAD (100ms)`.
    // Advance ctx by 1s to cover several steps.
    for (let i = 0; i < 40; i++) {
      ctx.advanceBy(25);
      vi.advanceTimersByTime(25);
    }

    // Step 0 and step 2 should both fire at least once.
    const triggeredSamples = trigger.mock.calls.map((c) => c[0]);
    expect(triggeredSamples.some((s) => s === sample)).toBe(true);
    // onStepChange should be called with the step index (eventually 0, 2, ...).
    const reportedSteps = onStepChange.mock.calls.map((c) => c[0]);
    expect(reportedSteps).toContain(0);
    expect(reportedSteps).toContain(2);
  });

  it('skips steps where pattern is empty', () => {
    const trigger = vi.fn();
    const ctx = makeFakeContext();
    const sample = { buffer: { duration: 0.5 } };
    const samples = { '0-0': sample };
    // No active steps in pattern
    renderHook(() =>
      useSequencer({
        audioContext: ctx,
        samples,
        patterns: { '0-0': Array(16).fill(false) },
        bpm: 120,
        isPlaying: true,
        onStepChange: vi.fn(),
        trigger,
      }),
    );
    for (let i = 0; i < 40; i++) {
      ctx.advanceBy(25);
      vi.advanceTimersByTime(25);
    }
    expect(trigger).not.toHaveBeenCalled();
  });

  it('skips pads whose sample has no buffer', () => {
    const trigger = vi.fn();
    const ctx = makeFakeContext();
    // Pad has a sample object but buffer is null (e.g., loading or removed)
    const samples = { '0-0': { buffer: null } };
    renderHook(() =>
      useSequencer({
        audioContext: ctx,
        samples,
        patterns: { '0-0': [true, ...Array(15).fill(false)] },
        bpm: 120,
        isPlaying: true,
        onStepChange: vi.fn(),
        trigger,
      }),
    );
    for (let i = 0; i < 40; i++) {
      ctx.advanceBy(25);
      vi.advanceTimersByTime(25);
    }
    expect(trigger).not.toHaveBeenCalled();
  });

  it('reports -1 when scheduler stops (cleanup)', () => {
    const onStepChange = vi.fn();
    const ctx = makeFakeContext();
    const { rerender } = renderHook(
      ({ playing }) =>
        useSequencer({
          audioContext: ctx,
          samples: {},
          patterns: {},
          bpm: 120,
          isPlaying: playing,
          onStepChange,
          trigger: vi.fn(),
        }),
      { initialProps: { playing: true } },
    );
    onStepChange.mockClear();
    // Stop playback — cleanup should fire and report step -1
    rerender({ playing: false });
    expect(onStepChange).toHaveBeenCalledWith(-1);
  });

  it('uses fresh BPM ref without restarting the scheduler effect', () => {
    // The hook intentionally reads bpm from a ref so that BPM changes during
    // playback don't tear down the scheduler. Verify the ref updates.
    const onStepChange = vi.fn();
    const ctx = makeFakeContext();
    const trigger = vi.fn();
    const { rerender } = renderHook(
      ({ bpm }) =>
        useSequencer({
          audioContext: ctx,
          samples: {},
          patterns: {},
          bpm,
          isPlaying: true,
          onStepChange,
          trigger,
        }),
      { initialProps: { bpm: 90 } },
    );
    onStepChange.mockClear();
    // Change BPM — this should NOT cause cleanup (no -1 dispatched).
    rerender({ bpm: 140 });
    expect(onStepChange).not.toHaveBeenCalledWith(-1);
  });
});
