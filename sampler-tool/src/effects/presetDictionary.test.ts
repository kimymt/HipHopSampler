import { describe, it, expect } from 'vitest';
import {
  chipKeywords,
  extendedKeywords,
  presetDictionary,
  findPresetByKeyword,
  findPresetBySubstring,
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
  it('exposes 291 entries after Phase 2B.4 expansion (300-target dictionary)', () => {
    // Grew from 25 → 291 in Phase 2B.4. Distribution by type:
    //   reverb 81 + filter 71 + delay 42 + saturation 36 + lofi 41
    //   plus the 1 filter ぼんやり inherited from before grouping = 271?
    // Actual count is 291; if you change the dictionary, regenerate by
    // running: grep -c "^  { keyword:" src/effects/presetDictionary.ts
    // and subtract the 12 chip entries.
    expect(extendedKeywords).toHaveLength(291);
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
  it('is the union of chip and extended (303 entries after Phase 2B.4)', () => {
    expect(presetDictionary).toHaveLength(303);
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
    // Use a string deliberately absent from the dictionary. Past versions
    // used "ピヨピヨ" but Phase 2B.4 added it as a chirp filter entry, so
    // pick something even more unlikely to ever be added.
    expect(findPresetByKeyword('ぱんだぱんだぱんだ')).toBeUndefined();
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

describe('findPresetBySubstring', () => {
  it('finds a preset whose keyword appears inside a longer phrase', () => {
    // "ホールに響く感じ" should match either ホール or 響く. Longest-first
    // wins so it picks ホール (4 chars).
    const e = findPresetBySubstring('ホールに響く感じ');
    expect(e).toBeDefined();
    expect(e?.keyword).toBe('ホール');
    expect(e?.type).toBe('reverb');
  });

  it('prefers the longest matching keyword over shorter ones', () => {
    // "AMラジオの音" contains both "AMラジオ" (5 chars) and "ラジオ" (3).
    // Without longest-first preference, the iteration order would decide.
    const e = findPresetBySubstring('AMラジオの音');
    expect(e?.keyword).toBe('AMラジオ');
  });

  it('returns undefined when no dictionary keyword is contained in the input', () => {
    expect(findPresetBySubstring('完全に独自の音')).toBeUndefined();
    expect(findPresetBySubstring('')).toBeUndefined();
    expect(findPresetBySubstring('   ')).toBeUndefined();
  });

  it('handles natural reverb phrasing across the new vocabulary', () => {
    expect(findPresetBySubstring('ライブハウスっぽく')?.type).toBe('reverb');
    expect(findPresetBySubstring('反響しまくりで')?.type).toBe('reverb');
    expect(findPresetBySubstring('トンネルの中で叫ぶ感じ')?.type).toBe('filter');
  });
});
