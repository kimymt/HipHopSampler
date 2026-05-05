import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoChop } from './useAutoChop';

// Mock onsetDetect so we can control the slice points without synthesizing
// audio. The hook only cares about the shape of the return values.
vi.mock('../utils/onsetDetect', () => ({
  detectOnsets: vi.fn(() => [0.5, 1.5, 2.5, 3.5]),
  buildSlicePoints: vi.fn(() => [0, 0.5, 1.5, 2.5, 3.5, 4.0]), // 5 slices
}));

import { detectOnsets, buildSlicePoints } from '../utils/onsetDetect';

function makeSample(overrides = {}) {
  return {
    buffer: { duration: 4 },
    sourceId: 'src-abc',
    name: 'kick.wav',
    startTime: 0,
    endTime: 4,
    loop: false,
    loopStart: 0,
    loopEnd: 4,
    volume: 1,
    pan: 0,
    ...overrides,
  };
}

describe('useAutoChop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    detectOnsets.mockReturnValue([0.5, 1.5, 2.5, 3.5]);
    buildSlicePoints.mockReturnValue([0, 0.5, 1.5, 2.5, 3.5, 4.0]);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null chopMessage and a runAutoChop fn', () => {
    const { result } = renderHook(() =>
      useAutoChop({
        selectedSample: makeSample(),
        selectedPadId: '0-0',
        stopAll: vi.fn(),
        updateMany: vi.fn(),
      }),
    );
    expect(result.current.chopMessage).toBeNull();
    expect(typeof result.current.runAutoChop).toBe('function');
  });

  it('does nothing when selectedSample is null', () => {
    const stopAll = vi.fn();
    const updateMany = vi.fn();
    const { result } = renderHook(() =>
      useAutoChop({ selectedSample: null, selectedPadId: '0-0', stopAll, updateMany }),
    );
    act(() => result.current.runAutoChop());
    expect(stopAll).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('does nothing when selectedSample has no buffer', () => {
    const stopAll = vi.fn();
    const updateMany = vi.fn();
    const { result } = renderHook(() =>
      useAutoChop({
        selectedSample: { ...makeSample(), buffer: null },
        selectedPadId: '0-0',
        stopAll,
        updateMany,
      }),
    );
    act(() => result.current.runAutoChop());
    expect(stopAll).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('does nothing when selectedPadId is null', () => {
    const updateMany = vi.fn();
    const { result } = renderHook(() =>
      useAutoChop({
        selectedSample: makeSample(),
        selectedPadId: null,
        stopAll: vi.fn(),
        updateMany,
      }),
    );
    act(() => result.current.runAutoChop());
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('shows a not-found message when fewer than 2 slice points are detected', () => {
    buildSlicePoints.mockReturnValue([0, 4]); // only 1 slice
    const updateMany = vi.fn();
    const { result } = renderHook(() =>
      useAutoChop({
        selectedSample: makeSample(),
        selectedPadId: '0-0',
        stopAll: vi.fn(),
        updateMany,
      }),
    );
    act(() => result.current.runAutoChop());
    expect(result.current.chopMessage).toMatch(/見つかりません/);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('clears the not-found message after 4 seconds', () => {
    buildSlicePoints.mockReturnValue([0, 4]);
    const { result } = renderHook(() =>
      useAutoChop({
        selectedSample: makeSample(),
        selectedPadId: '0-0',
        stopAll: vi.fn(),
        updateMany: vi.fn(),
      }),
    );
    act(() => result.current.runAutoChop());
    expect(result.current.chopMessage).not.toBeNull();
    act(() => vi.advanceTimersByTime(4000));
    expect(result.current.chopMessage).toBeNull();
  });

  it('assigns N slices to N consecutive pads starting from selectedPadId', () => {
    const updateMany = vi.fn();
    const { result } = renderHook(() =>
      useAutoChop({
        selectedSample: makeSample(),
        selectedPadId: '1-0', // start at row 1, col 0 = index 4
        stopAll: vi.fn(),
        updateMany,
      }),
    );
    act(() => result.current.runAutoChop());

    expect(updateMany).toHaveBeenCalledTimes(1);
    const updates = updateMany.mock.calls[0][0];
    const padIds = Object.keys(updates);

    // 5 slices → 5 pads, starting from '1-0'
    expect(padIds).toEqual(['1-0', '1-1', '1-2', '1-3', '2-0']);

    // First slice keeps original name; subsequent get suffixes
    expect(updates['1-0'].name).toBe('kick.wav');
    expect(updates['1-1'].name).toBe('kick.wav #2');
    expect(updates['2-0'].name).toBe('kick.wav #5');
  });

  it('wraps around when starting near the end of the pad grid', () => {
    const updateMany = vi.fn();
    const { result } = renderHook(() =>
      useAutoChop({
        selectedSample: makeSample(),
        selectedPadId: '3-3', // last pad (index 15)
        stopAll: vi.fn(),
        updateMany,
      }),
    );
    act(() => result.current.runAutoChop());
    const padIds = Object.keys(updateMany.mock.calls[0][0]);
    // 5 slices: '3-3' + wrap to '0-0', '0-1', '0-2', '0-3'
    expect(padIds).toEqual(['3-3', '0-0', '0-1', '0-2', '0-3']);
  });

  it('all assigned pads share the same chopGroup id and source bytes', () => {
    const updateMany = vi.fn();
    const sample = makeSample({ sourceId: 'src-shared-bytes' });
    const { result } = renderHook(() =>
      useAutoChop({
        selectedSample: sample,
        selectedPadId: '0-0',
        stopAll: vi.fn(),
        updateMany,
      }),
    );
    act(() => result.current.runAutoChop());
    const updates = updateMany.mock.calls[0][0];
    const groupIds = new Set(Object.values(updates).map((u) => u.chopGroup));
    const sourceIds = new Set(Object.values(updates).map((u) => u.sourceId));
    const buffers = new Set(Object.values(updates).map((u) => u.buffer));

    expect(groupIds.size).toBe(1);
    expect(groupIds.has(undefined)).toBe(false);
    expect(sourceIds.size).toBe(1);
    expect(sourceIds.has('src-shared-bytes')).toBe(true);
    // All siblings reference the same AudioBuffer instance (no duplication).
    expect(buffers.size).toBe(1);
  });

  it('assigns correct startTime and endTime per slice from buildSlicePoints', () => {
    const updateMany = vi.fn();
    const { result } = renderHook(() =>
      useAutoChop({
        selectedSample: makeSample(),
        selectedPadId: '0-0',
        stopAll: vi.fn(),
        updateMany,
      }),
    );
    act(() => result.current.runAutoChop());
    const updates = updateMany.mock.calls[0][0];

    // points = [0, 0.5, 1.5, 2.5, 3.5, 4.0]
    expect(updates['0-0'].startTime).toBe(0);
    expect(updates['0-0'].endTime).toBe(0.5);
    expect(updates['0-1'].startTime).toBe(0.5);
    expect(updates['0-1'].endTime).toBe(1.5);
    expect(updates['0-3'].startTime).toBe(2.5);
    expect(updates['0-3'].endTime).toBe(3.5);
    expect(updates['1-0'].startTime).toBe(3.5);
    expect(updates['1-0'].endTime).toBe(4.0);
  });

  it('sets chopIndex incrementally starting at 0', () => {
    const updateMany = vi.fn();
    const { result } = renderHook(() =>
      useAutoChop({
        selectedSample: makeSample(),
        selectedPadId: '0-0',
        stopAll: vi.fn(),
        updateMany,
      }),
    );
    act(() => result.current.runAutoChop());
    const updates = updateMany.mock.calls[0][0];
    expect(updates['0-0'].chopIndex).toBe(0);
    expect(updates['0-1'].chopIndex).toBe(1);
    expect(updates['1-0'].chopIndex).toBe(4);
  });

  it('calls stopAll before applying chops to avoid playing stale audio', () => {
    const callOrder = [];
    const stopAll = vi.fn(() => callOrder.push('stopAll'));
    const updateMany = vi.fn(() => callOrder.push('updateMany'));
    const { result } = renderHook(() =>
      useAutoChop({
        selectedSample: makeSample(),
        selectedPadId: '0-0',
        stopAll,
        updateMany,
      }),
    );
    act(() => result.current.runAutoChop());
    expect(callOrder).toEqual(['stopAll', 'updateMany']);
  });

  it('shows a success message that auto-clears after 3 seconds', () => {
    const { result } = renderHook(() =>
      useAutoChop({
        selectedSample: makeSample(),
        selectedPadId: '0-0',
        stopAll: vi.fn(),
        updateMany: vi.fn(),
      }),
    );
    act(() => result.current.runAutoChop());
    expect(result.current.chopMessage).toMatch(/5スライス/);
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.chopMessage).toBeNull();
  });

  it('replaces a stale message timer if runAutoChop is called twice quickly', () => {
    buildSlicePoints
      .mockReturnValueOnce([0, 4]) // first call: too few slices, error message
      .mockReturnValueOnce([0, 0.5, 1.5, 2.5, 3.5, 4.0]); // second: success
    const { result } = renderHook(() =>
      useAutoChop({
        selectedSample: makeSample(),
        selectedPadId: '0-0',
        stopAll: vi.fn(),
        updateMany: vi.fn(),
      }),
    );
    act(() => result.current.runAutoChop());
    expect(result.current.chopMessage).toMatch(/見つかりません/);
    // Second invocation immediately after — message should switch.
    act(() => result.current.runAutoChop());
    expect(result.current.chopMessage).toMatch(/5スライス/);
    // Advance only 3s — the stale 4s timer would still be live with naive
    // setTimeout; with proper ref-based cleanup, the message stays cleared
    // after 3s and does not re-clear at 4s.
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.chopMessage).toBeNull();
  });
});
