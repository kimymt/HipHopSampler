import { describe, it, expect } from 'vitest';
import {
  chipKeywords,
  extendedKeywords,
  presetDictionary,
  findPresetByKeyword,
} from './presetDictionary';
import { EFFECT_TYPES, type EffectType } from './types';

/**
 * Phase 2A preset dictionary contract tests.
 *
 * The dictionary is referenced from EffectVibeChips and (in Phase 2B) from a
 * text-input matcher. Tests pin down the shape and counts so a careless edit
 * to the dictionary doesn't silently change the chip lineup.
 */

describe('chipKeywords', () => {
  it('exposes exactly 12 entries (DESIGN.md §9.15: chip 8-12, current 12)', () => {
    expect(chipKeywords).toHaveLength(12);
  });

  it('every entry has a valid EffectType', () => {
    const validTypes = new Set<EffectType>(EFFECT_TYPES);
    for (const e of chipKeywords) {
      expect(validTypes.has(e.type)).toBe(true);
    }
  });

  it('every wet/param falls in [0, 1]', () => {
    for (const e of chipKeywords) {
      expect(e.wet).toBeGreaterThanOrEqual(0);
      expect(e.wet).toBeLessThanOrEqual(1);
      expect(e.param).toBeGreaterThanOrEqual(0);
      expect(e.param).toBeLessThanOrEqual(1);
    }
  });

  it('uses no "none" type — chip taps must produce an audible effect', () => {
    for (const e of chipKeywords) {
      expect(e.type).not.toBe('none');
    }
  });

  it('every chip has a non-empty Japanese keyword', () => {
    for (const e of chipKeywords) {
      expect(e.keyword.length).toBeGreaterThan(0);
      expect(e.keyword.trim()).toBe(e.keyword);
    }
  });

  it('covers reverb, filter, saturation, and lofi (delay deferred to Phase 2B)', () => {
    // Current Phase 2A chip lineup intentionally promotes the 12 most
    // immediately-recognizable Japanese vibe words. None of the delay-flavor
    // words (やまびこ / ピンポン / スラップバック / ダブ) made the top-12 cut —
    // they live in extendedKeywords and surface via Phase 2B text input.
    //
    // If Phase 2B telemetry shows delay-flavor words are common requests,
    // promote one (likely やまびこ or ピンポン) into chipKeywords and demote
    // the least-popular existing chip (e.g. テープ overlaps with ローファイ).
    const seen = new Set(chipKeywords.map((e) => e.type));
    expect(seen.has('reverb')).toBe(true);
    expect(seen.has('filter')).toBe(true);
    expect(seen.has('saturation')).toBe(true);
    expect(seen.has('lofi')).toBe(true);
    // delay is intentionally absent in Phase 2A. Pin this so a chip lineup
    // edit that adds delay also has to consciously update this test.
    expect(seen.has('delay')).toBe(false);
  });
});

describe('extendedKeywords', () => {
  it('exposes exactly 18 entries (Phase 2B reserved set)', () => {
    expect(extendedKeywords).toHaveLength(18);
  });

  it('every entry has a valid EffectType and clamped wet/param', () => {
    const validTypes = new Set<EffectType>(EFFECT_TYPES);
    for (const e of extendedKeywords) {
      expect(validTypes.has(e.type)).toBe(true);
      expect(e.wet).toBeGreaterThanOrEqual(0);
      expect(e.wet).toBeLessThanOrEqual(1);
      expect(e.param).toBeGreaterThanOrEqual(0);
      expect(e.param).toBeLessThanOrEqual(1);
    }
  });
});

describe('presetDictionary', () => {
  it('is the union of chip and extended (30 entries)', () => {
    expect(presetDictionary).toHaveLength(30);
    expect(presetDictionary.length).toBe(chipKeywords.length + extendedKeywords.length);
  });

  it('has no duplicate keywords across chip + extended', () => {
    const keys = presetDictionary.map((e) => e.keyword.toLowerCase());
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });
});

describe('findPresetByKeyword', () => {
  it('returns the chip entry for a known keyword', () => {
    const e = findPresetByKeyword('水中');
    expect(e).toBeDefined();
    expect(e?.type).toBe('filter');
    expect(e?.wet).toBeCloseTo(0.7);
    expect(e?.param).toBeCloseTo(0.2);
  });

  it('returns the extended entry for a Phase-2B-only keyword', () => {
    const e = findPresetByKeyword('教会');
    expect(e).toBeDefined();
    expect(e?.type).toBe('reverb');
  });

  it('returns undefined for an unknown keyword', () => {
    expect(findPresetByKeyword('ピヨピヨ')).toBeUndefined();
  });

  it('is case-insensitive (matters for AMラジオ vs amラジオ)', () => {
    const lower = findPresetByKeyword('amラジオ');
    const upper = findPresetByKeyword('AMラジオ');
    expect(lower).toBeDefined();
    expect(upper).toBeDefined();
    expect(lower).toEqual(upper);
  });

  it('trims surrounding whitespace before lookup', () => {
    expect(findPresetByKeyword('  水中  ')).toBeDefined();
  });
});
