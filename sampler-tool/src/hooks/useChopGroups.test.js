import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChopGroups } from './useChopGroups';

// Minimal sample shape for the hook to operate on.
function makeSample({ chopGroup, chopIndex, startTime, endTime, duration = 4 }) {
  return {
    buffer: { duration },
    chopGroup,
    chopIndex,
    startTime,
    endTime,
  };
}

describe('useChopGroups', () => {
  it('returns null when there is no selected sample', () => {
    const { result } = renderHook(() =>
      useChopGroups({ selectedSample: null, samples: {}, updateMany: () => {} }),
    );
    expect(result.current.chopBoundaries).toBeNull();
  });

  it('returns null when the selected sample has no chopGroup', () => {
    const selectedSample = makeSample({ startTime: 0, endTime: 1 });
    const { result } = renderHook(() =>
      useChopGroups({ selectedSample, samples: {}, updateMany: () => {} }),
    );
    expect(result.current.chopBoundaries).toBeNull();
  });

  it('builds boundaries from chop group siblings, sorted by chopIndex', () => {
    const samples = {
      '0-2': makeSample({ chopGroup: 'g1', chopIndex: 2, startTime: 1.0, endTime: 1.5 }),
      '0-0': makeSample({ chopGroup: 'g1', chopIndex: 0, startTime: 0, endTime: 0.5 }),
      '0-1': makeSample({ chopGroup: 'g1', chopIndex: 1, startTime: 0.5, endTime: 1.0 }),
    };
    const selectedSample = samples['0-1'];
    const { result } = renderHook(() =>
      useChopGroups({ selectedSample, samples, updateMany: () => {} }),
    );
    expect(result.current.chopBoundaries).not.toBeNull();
    expect(result.current.chopBoundaries.times).toEqual([0, 0.5, 1.0, 1.5]);
    expect(result.current.chopBoundaries.currentIndex).toBe(1);
  });

  it('padIdsAt maps each boundary to its prev/next sibling pad ids', () => {
    const samples = {
      '0-0': makeSample({ chopGroup: 'g1', chopIndex: 0, startTime: 0, endTime: 0.5 }),
      '0-1': makeSample({ chopGroup: 'g1', chopIndex: 1, startTime: 0.5, endTime: 1.0 }),
    };
    const { result } = renderHook(() =>
      useChopGroups({ selectedSample: samples['0-0'], samples, updateMany: () => {} }),
    );
    const { padIdsAt } = result.current.chopBoundaries;
    // 3 boundaries (start, middle, end) for 2 siblings
    expect(padIdsAt.length).toBe(3);
    expect(padIdsAt[0]).toEqual({ prev: null, next: '0-0' });
    expect(padIdsAt[1]).toEqual({ prev: '0-0', next: '0-1' });
    expect(padIdsAt[2]).toEqual({ prev: '0-1', next: null });
  });

  it('handleBoundaryDrag updates IN of next sibling and OUT of prev sibling', () => {
    const samples = {
      '0-0': makeSample({ chopGroup: 'g1', chopIndex: 0, startTime: 0, endTime: 0.5 }),
      '0-1': makeSample({ chopGroup: 'g1', chopIndex: 1, startTime: 0.5, endTime: 1.0 }),
    };
    const updateMany = vi.fn();
    const { result } = renderHook(() =>
      useChopGroups({ selectedSample: samples['0-0'], samples, updateMany }),
    );

    // Drag the middle boundary (index 1) from 0.5 → 0.7
    result.current.handleBoundaryDrag(1, 0.7);
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      '0-0': { endTime: 0.7 },
      '0-1': { startTime: 0.7 },
    });
  });

  it('handleBoundaryDrag clamps within neighbor times so slices do not cross', () => {
    const samples = {
      '0-0': makeSample({ chopGroup: 'g1', chopIndex: 0, startTime: 0, endTime: 1.0 }),
      '0-1': makeSample({ chopGroup: 'g1', chopIndex: 1, startTime: 1.0, endTime: 2.0 }),
      '0-2': makeSample({ chopGroup: 'g1', chopIndex: 2, startTime: 2.0, endTime: 3.0 }),
    };
    const updateMany = vi.fn();
    const { result } = renderHook(() =>
      useChopGroups({ selectedSample: samples['0-0'], samples, updateMany }),
    );

    // Try to drag boundary 2 (between sibling 1 and 2) all the way to 5.0 —
    // far past the next neighbor at 3.0 (which is also the duration boundary).
    // It should clamp just below the next time (3.0 - 0.01 = 2.99).
    result.current.handleBoundaryDrag(2, 5.0);
    expect(updateMany).toHaveBeenCalledWith({
      '0-1': { endTime: 2.99 },
      '0-2': { startTime: 2.99 },
    });
  });

  it('handleBoundaryDrag does nothing when there are no boundaries', () => {
    const updateMany = vi.fn();
    const { result } = renderHook(() =>
      useChopGroups({ selectedSample: null, samples: {}, updateMany }),
    );
    result.current.handleBoundaryDrag(0, 1.0);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
