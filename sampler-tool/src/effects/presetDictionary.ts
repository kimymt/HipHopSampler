/**
 * Phase 2A: Keyword → Effect preset dictionary.
 *
 * Maps Japanese vibe keywords to {type, wet, param} tuples that feed directly
 * into the existing FxState. Designed for offline, zero-latency lookup.
 *
 * Why this exists (persona §1, DAW挫折者):
 *   "リバーブ SIZE 85% / WET 60%" は専門用語で挫折させる。"広い" 1タップで
 *   同じ結果が出れば、blank-page anxiety を回避できる。
 *
 * Two tiers per DESIGN.md §9.15:
 *   - chipKeywords (12): EffectVibeChips に表示する人気語。Phase 2A で唯一の入口。
 *   - extendedKeywords (18): 辞書に含むが UI 露出ナシ。Phase 2B で text input
 *     経由で初出 (LLM マッチ + 候補提示)。Phase 2A 期間中はアクセス不可。
 *
 * Dictionary is the foundation that survives Phase 2B/2C: when the LLM fails
 * or the user is offline, we always fall back to keyword lookup.
 */

import type { EffectType } from './types';

export interface PresetEntry {
  /** Japanese vibe keyword (lowercase comparison done at lookup time) */
  keyword: string;
  type: EffectType;
  /** 0..1 wet/dry mix */
  wet: number;
  /** 0..1 param value (mapped per-effect: filter cutoff, reverb size, etc.) */
  param: number;
  /** Optional human-readable hint, used in aria-live announcements */
  description?: string;
}

/**
 * 12 popular keywords surfaced as chips in EffectVibeChips.
 * Selection rationale (DESIGN.md §9.15):
 *   - 一般語のみ (DAW 用語ではない)
 *   - Effect type 全 5 種をカバー (none を除く)
 *   - 強さの両端 (狭い/広い、軽い/深い) を入れて学習効果を出す
 */
export const chipKeywords: readonly PresetEntry[] = [
  { keyword: '水中', type: 'filter', wet: 0.7, param: 0.2, description: 'こもった水中サウンド' },
  { keyword: 'ローファイ', type: 'lofi', wet: 0.7, param: 0.6, description: 'ローファイヒップホップ' },
  { keyword: '広い', type: 'reverb', wet: 0.6, param: 0.85, description: '広い空間の響き' },
  { keyword: '狭い', type: 'reverb', wet: 0.3, param: 0.15, description: '小さな部屋の響き' },
  { keyword: '歪み', type: 'saturation', wet: 0.7, param: 0.7, description: '荒い歪み' },
  { keyword: 'テープ', type: 'lofi', wet: 0.5, param: 0.4, description: 'カセットテープ風' },
  { keyword: 'クリア', type: 'filter', wet: 0.5, param: 0.85, description: '抜けの良いハイ' },
  { keyword: '電話', type: 'filter', wet: 0.9, param: 0.5, description: '電話越しのこもり' },
  { keyword: 'ヴィンテージ', type: 'saturation', wet: 0.5, param: 0.4, description: '温かいアナログ感' },
  { keyword: 'アシッド', type: 'filter', wet: 0.6, param: 0.3, description: 'アシッドハウス風' },
  { keyword: '深い', type: 'reverb', wet: 0.7, param: 0.7, description: '深いリバーブ' },
  { keyword: '軽い', type: 'reverb', wet: 0.3, param: 0.4, description: '軽い残響' },
];

/**
 * Remaining 18 keywords. Phase 2B 投入時に text input + LLM マッチで初出。
 * Phase 2A では UI 上のアクセス経路ナシ (このファイルから export はするが、
 * EffectVibeChips からは引かれない)。
 */
export const extendedKeywords: readonly PresetEntry[] = [
  { keyword: 'ぼんやり', type: 'filter', wet: 0.5, param: 0.25 },
  { keyword: '遠い', type: 'reverb', wet: 0.6, param: 0.7 },
  { keyword: '近い', type: 'reverb', wet: 0.1, param: 0.2 },
  { keyword: '教会', type: 'reverb', wet: 0.8, param: 0.95 },
  { keyword: '部屋', type: 'reverb', wet: 0.3, param: 0.4 },
  { keyword: 'スタジアム', type: 'reverb', wet: 0.7, param: 0.9 },
  { keyword: 'やまびこ', type: 'delay', wet: 0.5, param: 0.5 },
  { keyword: 'ダブ', type: 'delay', wet: 0.7, param: 0.7 },
  { keyword: 'ピンポン', type: 'delay', wet: 0.6, param: 0.4 },
  { keyword: 'スラップバック', type: 'delay', wet: 0.4, param: 0.15 },
  { keyword: 'ファズ', type: 'saturation', wet: 0.8, param: 0.85 },
  { keyword: 'ウォーム', type: 'saturation', wet: 0.4, param: 0.3 },
  { keyword: 'ブースト', type: 'saturation', wet: 0.3, param: 0.5 },
  { keyword: 'ラジオ', type: 'filter', wet: 0.85, param: 0.45 },
  { keyword: 'AMラジオ', type: 'filter', wet: 0.85, param: 0.5 },
  { keyword: 'カセット', type: 'lofi', wet: 0.6, param: 0.5 },
  { keyword: 'ローバッテリー', type: 'lofi', wet: 0.8, param: 0.7 },
  { keyword: '8bit', type: 'lofi', wet: 0.9, param: 0.85 },
];

/**
 * Combined dictionary (chip + extended) — 30 entries total.
 * Used by Phase 2B+ for text input matching. Phase 2A consumers should import
 * `chipKeywords` directly.
 */
export const presetDictionary: readonly PresetEntry[] = [...chipKeywords, ...extendedKeywords];

/**
 * Lookup helper. Case-insensitive, exact keyword match.
 * Returns undefined if no entry exists. Phase 2B will replace this with
 * fuzzy / LLM-based matching that still falls back to this exact lookup.
 */
export function findPresetByKeyword(keyword: string): PresetEntry | undefined {
  const k = keyword.trim().toLowerCase();
  return presetDictionary.find((e) => e.keyword.toLowerCase() === k);
}
