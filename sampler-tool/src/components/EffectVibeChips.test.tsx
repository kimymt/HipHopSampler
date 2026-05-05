import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { EffectVibeChips } from './EffectVibeChips';
import { chipKeywords } from '../effects/presetDictionary';
import type { FxState } from '../effects/types';

/**
 * Stateful wrapper mirroring production parent behavior: fx changes are
 * propagated back through React state so the drift-detection useEffect inside
 * EffectVibeChips sees an updated fx prop after each chip tap. Without this,
 * a vi.fn() onFxChange leaves fx stale and the drift detector misfires.
 *
 * Tests can intercept calls via the `onFxChange` callback override (e.g. to
 * record call counts) while keeping the state-echo behavior.
 */
const StatefulChips: React.FC<{
  initialFx: FxState;
  onFxChange?: (fx: FxState) => void;
  onVibeAnnounce?: (msg: string) => void;
}> = ({ initialFx, onFxChange, onVibeAnnounce }) => {
  const [fx, setFx] = useState<FxState>(initialFx);
  return (
    <EffectVibeChips
      fx={fx}
      onFxChange={(next) => {
        setFx(next);
        onFxChange?.(next);
      }}
      onVibeAnnounce={onVibeAnnounce}
    />
  );
};

/**
 * EffectVibeChips component tests.
 *
 * What we verify:
 *   - Exactly the 12 chipKeywords render (extended set must NOT leak into UI)
 *   - Tap → onFxChange fires with target type IMMEDIATELY (so the type-row
 *     auto-syncs without waiting for the ramp)
 *   - Tap → onFxChange eventually reaches the target wet/param via rAF ramp
 *   - prefers-reduced-motion → ramp is skipped, single onFxChange with the
 *     final values (no rAF loop, no intermediate frames)
 *   - onVibeAnnounce fires with the formatted "→ TYPE WET% · PARAM%" string
 *   - Manual fx drift (wet/param diverges by > 0.05) → active chip clears
 *   - aria-pressed reflects active state
 *
 * What we don't verify (covered by manual /qa):
 *   - Easing curve precision (visible result is what matters, not numeric path)
 *   - Scroll behavior, fade-mask CSS — that's CSS, not logic
 */

const DEFAULT_FX: FxState = { type: 'none', wet: 0.4, param: 0.5 };

// Helper to mock matchMedia for prefers-reduced-motion tests.
const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

beforeEach(() => {
  // Default: motion enabled. Individual tests opt into reduce-motion.
  mockMatchMedia(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('EffectVibeChips — rendering', () => {
  it('renders exactly the 12 chipKeywords (extendedKeywords must NOT appear)', () => {
    render(<StatefulChips initialFx={DEFAULT_FX} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(chipKeywords.length);
    expect(chipKeywords.length).toBe(12);

    // Spot-check: a Phase 2B-only keyword must NOT be in the DOM.
    expect(screen.queryByText('教会')).toBeNull();
    expect(screen.queryByText('ファズ')).toBeNull();
  });

  it('exposes each chip with descriptive aria-label including the description', () => {
    render(<StatefulChips initialFx={DEFAULT_FX} />);
    const suichu = screen.getByRole('button', { name: /水中.*こもった水中サウンド/ });
    expect(suichu).toBeDefined();
  });

  it('idle: no chip has aria-pressed=true', () => {
    render(<StatefulChips initialFx={DEFAULT_FX} />);
    const buttons = screen.getAllByRole('button');
    for (const b of buttons) {
      expect(b.getAttribute('aria-pressed')).toBe('false');
    }
  });
});

describe('EffectVibeChips — chip tap (motion enabled)', () => {
  it('calls onFxChange immediately with target type (parent type-row syncs instantly)', () => {
    const onFxChange = vi.fn();
    render(<StatefulChips initialFx={DEFAULT_FX} onFxChange={onFxChange} />);
    fireEvent.click(screen.getByText('水中'));

    // First call after tap = type switch with current wet/param preserved.
    // Why this matters: type-row updates to FILTER instantly, knobs ramp from
    // their current position so the user sees them move toward the target.
    expect(onFxChange).toHaveBeenCalled();
    const first = onFxChange.mock.calls[0][0];
    expect(first.type).toBe('filter');
    expect(first.wet).toBeCloseTo(DEFAULT_FX.wet);
    expect(first.param).toBeCloseTo(DEFAULT_FX.param);
  });

  it('eventually reaches target wet/param after the ramp completes', async () => {
    const onFxChange = vi.fn();
    render(<StatefulChips initialFx={DEFAULT_FX} onFxChange={onFxChange} />);
    fireEvent.click(screen.getByText('水中'));

    // Drive rAF until the ramp settles. happy-dom's rAF runs on next tick.
    await new Promise((resolve) => setTimeout(resolve, 400));

    const last = onFxChange.mock.calls[onFxChange.mock.calls.length - 1][0];
    expect(last.type).toBe('filter');
    // Target for 水中: wet 0.7, param 0.2 (DESIGN.md spec).
    expect(last.wet).toBeCloseTo(0.7, 2);
    expect(last.param).toBeCloseTo(0.2, 2);
  });

  it('marks the tapped chip as aria-pressed=true', () => {
    render(<StatefulChips initialFx={DEFAULT_FX} />);
    const chip = screen.getByText('ローファイ');
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
  });

  it('switching chips clears the previous active state (only one active)', () => {
    render(<StatefulChips initialFx={DEFAULT_FX} />);
    fireEvent.click(screen.getByText('水中'));
    fireEvent.click(screen.getByText('ローファイ'));

    expect(screen.getByText('ローファイ').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('水中').getAttribute('aria-pressed')).toBe('false');
  });

  it('fires onVibeAnnounce with formatted "→ TYPE WET% · PARAM%" string', () => {
    const onVibeAnnounce = vi.fn();
    render(<StatefulChips initialFx={DEFAULT_FX} onVibeAnnounce={onVibeAnnounce} />);
    fireEvent.click(screen.getByText('ローファイ'));
    // ローファイ → lofi 70% / 60%
    expect(onVibeAnnounce).toHaveBeenCalledWith('→ LOFI WET 70% · 60%');
  });
});

describe('EffectVibeChips — prefers-reduced-motion', () => {
  it('skips the rAF ramp and applies target values in a single onFxChange', () => {
    mockMatchMedia(true);
    const onFxChange = vi.fn();
    render(<StatefulChips initialFx={DEFAULT_FX} onFxChange={onFxChange} />);
    fireEvent.click(screen.getByText('水中'));

    // Reduced motion path: exactly one onFxChange call with the final values.
    // No rAF loop, no intermediate frames — accessibility users get instant
    // application without animation distraction.
    expect(onFxChange).toHaveBeenCalledTimes(1);
    const only = onFxChange.mock.calls[0][0];
    expect(only.type).toBe('filter');
    expect(only.wet).toBeCloseTo(0.7);
    expect(only.param).toBeCloseTo(0.2);
  });

  it('still announces the vibe even when motion is reduced', () => {
    mockMatchMedia(true);
    const onVibeAnnounce = vi.fn();
    render(<StatefulChips initialFx={DEFAULT_FX} onVibeAnnounce={onVibeAnnounce} />);
    fireEvent.click(screen.getByText('広い'));
    // 広い → reverb 60% / 85%
    expect(onVibeAnnounce).toHaveBeenCalledWith('→ REVERB WET 60% · 85%');
  });

  it('still marks the chip as aria-pressed=true with reduced motion', () => {
    mockMatchMedia(true);
    render(<StatefulChips initialFx={DEFAULT_FX} />);
    const chip = screen.getByText('深い');
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
  });

  it('does NOT fire any rAF callbacks (verified by absence of post-tap onFxChange calls)', async () => {
    mockMatchMedia(true);
    const onFxChange = vi.fn();
    render(<StatefulChips initialFx={DEFAULT_FX} onFxChange={onFxChange} />);
    fireEvent.click(screen.getByText('ローファイ'));

    // Wait beyond the 250ms ramp duration. If a rAF loop were running, it
    // would have fired multiple onFxChange calls by now.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(onFxChange).toHaveBeenCalledTimes(1);
  });
});

describe('EffectVibeChips — manual interaction clears active state', () => {
  // Helper component: lets the test forcibly drift fx to simulate a knob drag.
  const DriftableChips: React.FC<{
    initialFx: FxState;
    forcedFx?: FxState | null;
  }> = ({ initialFx, forcedFx }) => {
    const [fx, setFx] = useState<FxState>(initialFx);
    // When forcedFx is provided, override internal state on each render.
    const effectiveFx = forcedFx ?? fx;
    return <EffectVibeChips fx={effectiveFx} onFxChange={setFx} />;
  };

  it('clears aria-pressed when fx drifts away from the active chip target', async () => {
    // Strategy: tap chip, let ramp settle, then force fx into a divergent
    // state via the forcedFx prop (simulating a manual knob drag in App.tsx).
    const driftedFx: FxState = { type: 'lofi', wet: 0.3, param: 0.6 };

    const { rerender } = render(
      <DriftableChips initialFx={DEFAULT_FX} forcedFx={null} />,
    );
    fireEvent.click(screen.getByText('ローファイ'));
    expect(screen.getByText('ローファイ').getAttribute('aria-pressed')).toBe('true');

    // Let the ramp settle (animTargetRef → null).
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Now simulate manual knob drag: force fx away from the chip target.
    rerender(<DriftableChips initialFx={DEFAULT_FX} forcedFx={driftedFx} />);

    expect(screen.getByText('ローファイ').getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps active chip highlighted while fx still matches the target (within epsilon)', async () => {
    // Within 0.05 epsilon of target reverb 60/85 → should remain active.
    const closeFx: FxState = { type: 'reverb', wet: 0.62, param: 0.85 };

    const { rerender } = render(
      <DriftableChips initialFx={DEFAULT_FX} forcedFx={null} />,
    );
    fireEvent.click(screen.getByText('広い'));
    await new Promise((resolve) => setTimeout(resolve, 400));

    rerender(<DriftableChips initialFx={DEFAULT_FX} forcedFx={closeFx} />);

    expect(screen.getByText('広い').getAttribute('aria-pressed')).toBe('true');
  });
});
