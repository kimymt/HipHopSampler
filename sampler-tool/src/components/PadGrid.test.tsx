import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PadGrid } from './PadGrid';

/**
 * PadGrid long-press detection tests.
 *
 * What we verify:
 *   - Quick tap on a single pad: onPadClick fires on pointerup, onPadLongPress NEVER
 *   - Hold > 350ms on a single pad: onPadLongPress fires, onPadClick does NOT
 *   - Slide-away (pointerLeave/pointerCancel before release): neither fires
 *   - **Multi-touch (the v0.7.1.3 regression): two pads tapped in quick
 *     succession must NOT trigger onPadLongPress for either. Single-ref
 *     tracking caused the first pad's orphaned timer to fire 350ms later
 *     and open the editor for a pad the user thought they had only tapped.**
 *   - Multi-touch with one held + one tapped: only the held pad fires
 *     onPadLongPress; the tapped pad fires onPadClick.
 *
 * What we don't verify (covered by manual /qa on real device):
 *   - touch event coalescing in the browser
 *   - keyboard activation path (covered by useEffect listener, not these handlers)
 */

const LONG_PRESS_MS = 350;

const baseProps = {
  samples: { '0-0': { name: 'kick.wav', buffer: {} }, '0-1': { name: 'snare.wav', buffer: {} } },
  selectedPadId: null,
  onPadFilePicked: vi.fn(),
  micSupported: false,
  recordingPadId: null,
  recordingElapsedMs: 0,
  onMicStart: vi.fn(),
  onMicStop: vi.fn(),
};

describe('PadGrid long-press detection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('quick tap fires onPadClick on pointerup, not onPadLongPress', () => {
    const onPadClick = vi.fn();
    const onPadLongPress = vi.fn();
    render(<PadGrid {...baseProps} onPadClick={onPadClick} onPadLongPress={onPadLongPress} />);

    const pad = screen.getByLabelText(/Pad 1 .*kick\.wav/);
    fireEvent.pointerDown(pad);
    // Tap is faster than the long-press threshold.
    vi.advanceTimersByTime(50);
    fireEvent.pointerUp(pad);

    expect(onPadClick).toHaveBeenCalledTimes(1);
    expect(onPadClick).toHaveBeenCalledWith('0-0');
    expect(onPadLongPress).not.toHaveBeenCalled();
  });

  it('hold past 350ms fires onPadLongPress, never onPadClick', () => {
    const onPadClick = vi.fn();
    const onPadLongPress = vi.fn();
    render(<PadGrid {...baseProps} onPadClick={onPadClick} onPadLongPress={onPadLongPress} />);

    const pad = screen.getByLabelText(/Pad 1 .*kick\.wav/);
    fireEvent.pointerDown(pad);
    vi.advanceTimersByTime(LONG_PRESS_MS + 10);
    fireEvent.pointerUp(pad);

    expect(onPadLongPress).toHaveBeenCalledTimes(1);
    expect(onPadLongPress).toHaveBeenCalledWith('0-0');
    expect(onPadClick).not.toHaveBeenCalled();
  });

  it('slide-away before release fires neither handler', () => {
    const onPadClick = vi.fn();
    const onPadLongPress = vi.fn();
    render(<PadGrid {...baseProps} onPadClick={onPadClick} onPadLongPress={onPadLongPress} />);

    const pad = screen.getByLabelText(/Pad 1 .*kick\.wav/);
    fireEvent.pointerDown(pad);
    vi.advanceTimersByTime(100);
    fireEvent.pointerLeave(pad);
    // Even if we advance past the long-press threshold, the timer was cleared.
    vi.advanceTimersByTime(LONG_PRESS_MS);

    expect(onPadClick).not.toHaveBeenCalled();
    expect(onPadLongPress).not.toHaveBeenCalled();
  });

  it('multi-touch: two pads tapped in quick succession do NOT trigger long-press for either', () => {
    // This is the v0.7.1.3 regression. Single-ref state caused the first
    // pad's timer to be orphaned (still ticking) when the second pad's
    // pointerdown overwrote the ref; first pad's pointerup then cleared the
    // SECOND pad's timer; first pad's timer fired 350ms later and opened
    // the editor for a pad the user thought they had only tapped.
    const onPadClick = vi.fn();
    const onPadLongPress = vi.fn();
    render(<PadGrid {...baseProps} onPadClick={onPadClick} onPadLongPress={onPadLongPress} />);

    const padA = screen.getByLabelText(/Pad 1 .*kick\.wav/);
    const padB = screen.getByLabelText(/Pad 2 .*snare\.wav/);

    fireEvent.pointerDown(padA);
    vi.advanceTimersByTime(10);
    fireEvent.pointerDown(padB);
    vi.advanceTimersByTime(80);
    fireEvent.pointerUp(padA);
    vi.advanceTimersByTime(20);
    fireEvent.pointerUp(padB);

    // Wait well past the long-press threshold to confirm no orphaned timer
    // fires for either pad.
    vi.advanceTimersByTime(LONG_PRESS_MS * 2);

    expect(onPadLongPress).not.toHaveBeenCalled();
    expect(onPadClick).toHaveBeenCalledTimes(2);
    expect(onPadClick).toHaveBeenCalledWith('0-0');
    expect(onPadClick).toHaveBeenCalledWith('0-1');
  });

  it('multi-touch: one pad held + other tapped fires long-press only on the held one', () => {
    const onPadClick = vi.fn();
    const onPadLongPress = vi.fn();
    render(<PadGrid {...baseProps} onPadClick={onPadClick} onPadLongPress={onPadLongPress} />);

    const padA = screen.getByLabelText(/Pad 1 .*kick\.wav/);
    const padB = screen.getByLabelText(/Pad 2 .*snare\.wav/);

    // Press A and hold; tap B briefly while A is still down.
    fireEvent.pointerDown(padA);
    vi.advanceTimersByTime(50);
    fireEvent.pointerDown(padB);
    vi.advanceTimersByTime(80);
    fireEvent.pointerUp(padB);
    // Continue holding A past threshold.
    vi.advanceTimersByTime(LONG_PRESS_MS);
    fireEvent.pointerUp(padA);

    expect(onPadLongPress).toHaveBeenCalledTimes(1);
    expect(onPadLongPress).toHaveBeenCalledWith('0-0');
    expect(onPadClick).toHaveBeenCalledTimes(1);
    expect(onPadClick).toHaveBeenCalledWith('0-1');
  });
});
