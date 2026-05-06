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
 *   - chipKeywords (12): EffectVibeChips に表示する人気語。
 *   - extendedKeywords: 辞書に含むが UI 露出ナシ。Phase 2B の自由入力で
 *     初出 (substring matcher + LLM が引く)。
 *
 * Phase 2B.4 (2026-05-06): expanded extendedKeywords to ~290 entries grouped
 * by effect type. The substring matcher means each short fragment instantly
 * covers the dozens of natural wrappers users will type around it
 * ("〜っぽく", "〜な感じ", "〜にして", etc.).
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
 * Extended dictionary, grouped by effect type for readability. Substring
 * matcher (findPresetBySubstring) consumes this list; longest match wins,
 * so a longer compound entry like "コンサートホール" beats the shorter
 * "ホール" when both are contained in the input.
 *
 * Param ranges by type (matches src/effects/types.ts EFFECT_META):
 *   - reverb     : param 0..1 = small room → cathedral
 *   - delay      : param 0..1 = short slap-back → long echo
 *   - filter     : param 0..1 = muffled (low cutoff) → bright (high cutoff)
 *   - saturation : param 0..1 = clean → harsh distortion
 *   - lofi       : param 0..1 = subtle tape feel → bit-crushed
 *
 * Curation rules:
 *   - Keep entries to short noun/verb fragments where possible — substring
 *     match expands them automatically into "〜っぽく" / "〜な感じ" forms
 *   - Avoid duplicates whose substring already covers the variant (e.g.
 *     don't add "やまびこの音" if "やまびこ" is already present)
 *   - Skip excessively niche gear nerd terms (RE-201, メサブギー, etc.) —
 *     persona is DAW挫折者, not synth collector
 *   - When two types could plausibly fit (e.g. 滝 = filter underwater OR
 *     reverb spatial), pick the one that gives a more universally
 *     recognizable result — usually the spatial/textural reading
 */
export const extendedKeywords: readonly PresetEntry[] = [
  // ── REVERB (81) ──────────────────────────────────────────────────
  // Small indoor spaces
  { keyword: 'ぼんやり', type: 'filter', wet: 0.5, param: 0.25 },
  { keyword: '遠い', type: 'reverb', wet: 0.6, param: 0.7 },
  { keyword: '近い', type: 'reverb', wet: 0.1, param: 0.2 },
  { keyword: '教会', type: 'reverb', wet: 0.8, param: 0.95 },
  { keyword: '部屋', type: 'reverb', wet: 0.3, param: 0.4 },
  { keyword: 'スタジアム', type: 'reverb', wet: 0.7, param: 0.9 },
  { keyword: 'ホール', type: 'reverb', wet: 0.7, param: 0.9 },
  { keyword: '響く', type: 'reverb', wet: 0.6, param: 0.75 },
  { keyword: '響き', type: 'reverb', wet: 0.6, param: 0.75 },
  { keyword: '反響', type: 'reverb', wet: 0.7, param: 0.85 },
  { keyword: 'ライブハウス', type: 'reverb', wet: 0.5, param: 0.6 },
  { keyword: '寝室', type: 'reverb', wet: 0.25, param: 0.3 },
  { keyword: '押入れ', type: 'reverb', wet: 0.2, param: 0.1 },
  { keyword: 'お風呂', type: 'reverb', wet: 0.5, param: 0.4 },
  { keyword: 'バスルーム', type: 'reverb', wet: 0.5, param: 0.4 },
  { keyword: 'シャワー', type: 'reverb', wet: 0.55, param: 0.4 },
  { keyword: '廊下', type: 'reverb', wet: 0.4, param: 0.5 },
  { keyword: '階段', type: 'reverb', wet: 0.5, param: 0.55 },
  { keyword: '玄関', type: 'reverb', wet: 0.3, param: 0.3 },
  { keyword: '書斎', type: 'reverb', wet: 0.25, param: 0.35 },
  { keyword: 'キッチン', type: 'reverb', wet: 0.4, param: 0.4 },
  // Medium indoor
  { keyword: 'リビング', type: 'reverb', wet: 0.3, param: 0.45 },
  { keyword: 'オフィス', type: 'reverb', wet: 0.3, param: 0.5 },
  { keyword: 'カフェ', type: 'reverb', wet: 0.4, param: 0.55 },
  { keyword: '教室', type: 'reverb', wet: 0.4, param: 0.55 },
  { keyword: '会議室', type: 'reverb', wet: 0.35, param: 0.5 },
  { keyword: 'ロビー', type: 'reverb', wet: 0.5, param: 0.65 },
  { keyword: '待合室', type: 'reverb', wet: 0.35, param: 0.5 },
  { keyword: 'レストラン', type: 'reverb', wet: 0.45, param: 0.6 },
  { keyword: 'バー', type: 'reverb', wet: 0.5, param: 0.55 },
  { keyword: 'ジム', type: 'reverb', wet: 0.55, param: 0.7 },
  // Large indoor
  { keyword: '体育館', type: 'reverb', wet: 0.7, param: 0.85 },
  { keyword: '講堂', type: 'reverb', wet: 0.7, param: 0.9 },
  { keyword: 'コンサートホール', type: 'reverb', wet: 0.75, param: 0.95 },
  { keyword: '劇場', type: 'reverb', wet: 0.7, param: 0.85 },
  { keyword: '映画館', type: 'reverb', wet: 0.6, param: 0.75 },
  { keyword: 'ドーム', type: 'reverb', wet: 0.85, param: 0.95 },
  { keyword: 'アリーナ', type: 'reverb', wet: 0.75, param: 0.92 },
  { keyword: '工場', type: 'reverb', wet: 0.75, param: 0.85 },
  { keyword: '倉庫', type: 'reverb', wet: 0.75, param: 0.85 },
  { keyword: '駐車場', type: 'reverb', wet: 0.65, param: 0.8 },
  { keyword: '地下駐車場', type: 'reverb', wet: 0.8, param: 0.9 },
  { keyword: '駅', type: 'reverb', wet: 0.65, param: 0.85 },
  { keyword: '空港', type: 'reverb', wet: 0.65, param: 0.85 },
  // Religious / sacred
  { keyword: '大聖堂', type: 'reverb', wet: 0.85, param: 0.97 },
  { keyword: 'チャペル', type: 'reverb', wet: 0.7, param: 0.85 },
  { keyword: '修道院', type: 'reverb', wet: 0.7, param: 0.9 },
  { keyword: '神社', type: 'reverb', wet: 0.5, param: 0.7 },
  { keyword: '寺', type: 'reverb', wet: 0.6, param: 0.8 },
  { keyword: '廟', type: 'reverb', wet: 0.7, param: 0.85 },
  { keyword: '古城', type: 'reverb', wet: 0.75, param: 0.9 },
  // Outdoor / natural
  { keyword: '山', type: 'reverb', wet: 0.55, param: 0.85 },
  { keyword: '谷', type: 'reverb', wet: 0.7, param: 0.9 },
  { keyword: '渓谷', type: 'reverb', wet: 0.8, param: 0.92 },
  { keyword: '森', type: 'reverb', wet: 0.4, param: 0.6 },
  { keyword: '海岸', type: 'reverb', wet: 0.4, param: 0.7 },
  { keyword: '砂漠', type: 'reverb', wet: 0.3, param: 0.85 },
  { keyword: '公園', type: 'reverb', wet: 0.35, param: 0.55 },
  { keyword: '路地', type: 'reverb', wet: 0.4, param: 0.45 },
  { keyword: '屋上', type: 'reverb', wet: 0.3, param: 0.7 },
  { keyword: '田舎', type: 'reverb', wet: 0.35, param: 0.6 },
  { keyword: '滝', type: 'reverb', wet: 0.7, param: 0.85 },
  // Abstract / cosmic
  { keyword: '宇宙', type: 'reverb', wet: 0.85, param: 0.97 },
  { keyword: '銀河', type: 'reverb', wet: 0.85, param: 0.97 },
  { keyword: '異次元', type: 'reverb', wet: 0.8, param: 0.95 },
  { keyword: '夢の中', type: 'reverb', wet: 0.7, param: 0.7 },
  { keyword: '夢', type: 'reverb', wet: 0.7, param: 0.7 },
  { keyword: '天国', type: 'reverb', wet: 0.8, param: 0.9 },
  { keyword: '地獄', type: 'reverb', wet: 0.7, param: 0.85 },
  { keyword: '地下', type: 'reverb', wet: 0.6, param: 0.7 },
  { keyword: '地下室', type: 'reverb', wet: 0.65, param: 0.6 },
  { keyword: '地下道', type: 'reverb', wet: 0.7, param: 0.75 },
  // Genre / mood
  { keyword: 'アンビエント', type: 'reverb', wet: 0.85, param: 0.9 },
  { keyword: 'ニューエイジ', type: 'reverb', wet: 0.75, param: 0.85 },
  { keyword: 'シューゲイザー', type: 'reverb', wet: 0.85, param: 0.9 },
  { keyword: 'ドリームポップ', type: 'reverb', wet: 0.7, param: 0.8 },
  { keyword: 'オーケストラ', type: 'reverb', wet: 0.65, param: 0.85 },
  { keyword: 'クラシック', type: 'reverb', wet: 0.6, param: 0.8 },
  { keyword: 'ゴスペル', type: 'reverb', wet: 0.6, param: 0.75 },
  { keyword: 'シンフォニー', type: 'reverb', wet: 0.65, param: 0.85 },
  { keyword: 'プレート', type: 'reverb', wet: 0.55, param: 0.7 },
  { keyword: 'スプリング', type: 'reverb', wet: 0.5, param: 0.45 },
  { keyword: 'ルーム', type: 'reverb', wet: 0.35, param: 0.45 },
  { keyword: '神秘的', type: 'reverb', wet: 0.7, param: 0.85 },
  { keyword: '厳か', type: 'reverb', wet: 0.7, param: 0.85 },
  { keyword: '神聖', type: 'reverb', wet: 0.75, param: 0.9 },
  { keyword: '永遠', type: 'reverb', wet: 0.85, param: 0.95 },
  // UX-driven
  { keyword: '水族館', type: 'reverb', wet: 0.7, param: 0.7 },
  { keyword: 'アクアリウム', type: 'reverb', wet: 0.7, param: 0.7 },
  // Bell-class (moved from delay during 2B.4 self-review — bell sustain
  // reads as residual reverb, not discrete echoes)
  { keyword: 'ベル', type: 'reverb', wet: 0.5, param: 0.5 },
  { keyword: '鈴', type: 'reverb', wet: 0.45, param: 0.4 },
  { keyword: '鐘', type: 'reverb', wet: 0.55, param: 0.6 },

  // ── FILTER (71) ──────────────────────────────────────────────────
  // Underwater
  { keyword: 'トンネル', type: 'filter', wet: 0.8, param: 0.3 },
  { keyword: '海中', type: 'filter', wet: 0.75, param: 0.18 },
  { keyword: '海底', type: 'filter', wet: 0.8, param: 0.15 },
  { keyword: 'プール', type: 'filter', wet: 0.7, param: 0.25 },
  { keyword: '風呂', type: 'filter', wet: 0.6, param: 0.3 },
  { keyword: '湖', type: 'filter', wet: 0.7, param: 0.3 },
  { keyword: '川', type: 'filter', wet: 0.5, param: 0.4 },
  { keyword: '雨の中', type: 'filter', wet: 0.5, param: 0.45 },
  { keyword: '霧の中', type: 'filter', wet: 0.6, param: 0.4 },
  { keyword: '雪の中', type: 'filter', wet: 0.6, param: 0.4 },
  { keyword: '雲の中', type: 'filter', wet: 0.55, param: 0.4 },
  // Through barriers
  { keyword: '壁越し', type: 'filter', wet: 0.7, param: 0.3 },
  { keyword: 'ドア越し', type: 'filter', wet: 0.7, param: 0.35 },
  { keyword: '窓越し', type: 'filter', wet: 0.5, param: 0.5 },
  { keyword: 'ガラス越し', type: 'filter', wet: 0.55, param: 0.5 },
  { keyword: '隣の部屋', type: 'filter', wet: 0.7, param: 0.3 },
  { keyword: 'カーテン越し', type: 'filter', wet: 0.4, param: 0.4 },
  { keyword: '厚い壁', type: 'filter', wet: 0.85, param: 0.2 },
  { keyword: '布越し', type: 'filter', wet: 0.55, param: 0.3 },
  { keyword: 'マイク越し', type: 'filter', wet: 0.6, param: 0.55 },
  // Phone / radio
  { keyword: 'ラジオ', type: 'filter', wet: 0.85, param: 0.45 },
  { keyword: 'AMラジオ', type: 'filter', wet: 0.85, param: 0.5 },
  { keyword: '古い電話', type: 'filter', wet: 0.9, param: 0.45 },
  { keyword: '国際電話', type: 'filter', wet: 0.85, param: 0.5 },
  { keyword: '携帯電話', type: 'filter', wet: 0.85, param: 0.55 },
  { keyword: '公衆電話', type: 'filter', wet: 0.9, param: 0.5 },
  { keyword: 'インターホン', type: 'filter', wet: 0.85, param: 0.5 },
  { keyword: '受話器', type: 'filter', wet: 0.9, param: 0.5 },
  { keyword: '短波', type: 'filter', wet: 0.85, param: 0.5 },
  { keyword: 'FMラジオ', type: 'filter', wet: 0.75, param: 0.7 },
  { keyword: 'アナウンス', type: 'filter', wet: 0.8, param: 0.55 },
  { keyword: '駅のアナウンス', type: 'filter', wet: 0.85, param: 0.5 },
  { keyword: '店内放送', type: 'filter', wet: 0.85, param: 0.55 },
  { keyword: 'ヘリコプター', type: 'filter', wet: 0.85, param: 0.4 },
  { keyword: 'パトカー', type: 'filter', wet: 0.85, param: 0.5 },
  { keyword: 'メガホン', type: 'filter', wet: 0.85, param: 0.55 },
  { keyword: '拡声器', type: 'filter', wet: 0.85, param: 0.55 },
  // Vehicles / industrial
  { keyword: '電車の中', type: 'filter', wet: 0.65, param: 0.4 },
  { keyword: '地下鉄', type: 'filter', wet: 0.7, param: 0.35 },
  { keyword: '飛行機', type: 'filter', wet: 0.6, param: 0.45 },
  { keyword: '工事現場', type: 'filter', wet: 0.5, param: 0.35 },
  { keyword: '工場の中', type: 'filter', wet: 0.7, param: 0.3 },
  // Bright / clear
  { keyword: '透明', type: 'filter', wet: 0.5, param: 0.95 },
  { keyword: 'クリスタル', type: 'filter', wet: 0.6, param: 0.95 },
  { keyword: '鮮やか', type: 'filter', wet: 0.5, param: 0.85 },
  { keyword: '澄んだ', type: 'filter', wet: 0.5, param: 0.9 },
  { keyword: 'シャープ', type: 'filter', wet: 0.6, param: 0.92 },
  { keyword: 'ハイファイ', type: 'filter', wet: 0.4, param: 0.95 },
  { keyword: 'ハイ', type: 'filter', wet: 0.6, param: 0.95 },
  { keyword: '高音', type: 'filter', wet: 0.6, param: 0.9 },
  { keyword: '軽やか', type: 'filter', wet: 0.45, param: 0.85 },
  // Hazy / soft
  { keyword: 'ほのか', type: 'filter', wet: 0.5, param: 0.4 },
  { keyword: '朧', type: 'filter', wet: 0.55, param: 0.3 },
  { keyword: 'もや', type: 'filter', wet: 0.55, param: 0.35 },
  { keyword: '霞', type: 'filter', wet: 0.55, param: 0.35 },
  { keyword: '黄昏', type: 'filter', wet: 0.5, param: 0.4 },
  { keyword: 'ふわふわ', type: 'filter', wet: 0.45, param: 0.45 },
  { keyword: '夢心地', type: 'filter', wet: 0.6, param: 0.4 },
  { keyword: '朦朧', type: 'filter', wet: 0.6, param: 0.3 },
  { keyword: '半透明', type: 'filter', wet: 0.5, param: 0.5 },
  { keyword: '暗闇', type: 'filter', wet: 0.7, param: 0.2 },
  { keyword: '影', type: 'filter', wet: 0.6, param: 0.3 },
  { keyword: '闇', type: 'filter', wet: 0.7, param: 0.2 },
  // Acid / squelchy
  { keyword: '303', type: 'filter', wet: 0.65, param: 0.35 },
  { keyword: 'ベースライン', type: 'filter', wet: 0.6, param: 0.4 },
  { keyword: 'ワブル', type: 'filter', wet: 0.7, param: 0.3 },
  // Sci-fi
  { keyword: 'レーザー', type: 'filter', wet: 0.6, param: 0.95 },
  { keyword: 'ロボット', type: 'filter', wet: 0.7, param: 0.55 },
  { keyword: '宇宙人', type: 'filter', wet: 0.7, param: 0.5 },
  { keyword: 'UFO', type: 'filter', wet: 0.7, param: 0.55 },
  { keyword: '機械音', type: 'filter', wet: 0.7, param: 0.5 },
  // Onomatopoeia
  { keyword: 'ピヨピヨ', type: 'filter', wet: 0.7, param: 0.85 },
  { keyword: 'キンキン', type: 'filter', wet: 0.7, param: 0.95 },
  { keyword: 'シャリシャリ', type: 'filter', wet: 0.6, param: 0.9 },
  { keyword: 'モコモコ', type: 'filter', wet: 0.7, param: 0.2 },

  // ── DELAY (42) ───────────────────────────────────────────────────
  { keyword: 'やまびこ', type: 'delay', wet: 0.5, param: 0.5 },
  { keyword: 'ダブ', type: 'delay', wet: 0.7, param: 0.7 },
  { keyword: 'ピンポン', type: 'delay', wet: 0.6, param: 0.4 },
  { keyword: 'スラップバック', type: 'delay', wet: 0.4, param: 0.15 },
  { keyword: 'エコー', type: 'delay', wet: 0.5, param: 0.4 },
  { keyword: 'テープエコー', type: 'delay', wet: 0.6, param: 0.5 },
  { keyword: 'アナログエコー', type: 'delay', wet: 0.55, param: 0.5 },
  { keyword: 'デジタルディレイ', type: 'delay', wet: 0.5, param: 0.4 },
  { keyword: 'ロングディレイ', type: 'delay', wet: 0.6, param: 0.85 },
  { keyword: 'ショートディレイ', type: 'delay', wet: 0.4, param: 0.15 },
  { keyword: 'スラップ', type: 'delay', wet: 0.4, param: 0.15 },
  { keyword: 'リズミック', type: 'delay', wet: 0.5, param: 0.5 },
  { keyword: '谷の音', type: 'delay', wet: 0.6, param: 0.7 },
  { keyword: '木霊', type: 'delay', wet: 0.55, param: 0.55 },
  { keyword: 'こだま', type: 'delay', wet: 0.55, param: 0.55 },
  { keyword: '反射', type: 'delay', wet: 0.5, param: 0.5 },
  { keyword: 'オウム返し', type: 'delay', wet: 0.4, param: 0.1 },
  { keyword: 'ダブミュージック', type: 'delay', wet: 0.7, param: 0.7 },
  { keyword: 'レゲエ', type: 'delay', wet: 0.55, param: 0.55 },
  { keyword: 'デジタルダブ', type: 'delay', wet: 0.65, param: 0.65 },
  { keyword: 'テクノ', type: 'delay', wet: 0.45, param: 0.4 },
  { keyword: 'ハウス', type: 'delay', wet: 0.4, param: 0.35 },
  { keyword: 'アンビエントハウス', type: 'delay', wet: 0.6, param: 0.7 },
  { keyword: 'サイケデリック', type: 'delay', wet: 0.7, param: 0.6 },
  { keyword: 'トリップホップ', type: 'delay', wet: 0.55, param: 0.55 },
  { keyword: 'スペースエコー', type: 'delay', wet: 0.65, param: 0.6 },
  { keyword: 'ロランド', type: 'delay', wet: 0.55, param: 0.5 },
  { keyword: 'トリプレット', type: 'delay', wet: 0.5, param: 0.5 },
  { keyword: 'ドット', type: 'delay', wet: 0.5, param: 0.4 },
  { keyword: 'シンコペーション', type: 'delay', wet: 0.5, param: 0.45 },
  { keyword: 'オフビート', type: 'delay', wet: 0.5, param: 0.5 },
  { keyword: 'シャッフル', type: 'delay', wet: 0.45, param: 0.4 },
  { keyword: 'シネマ', type: 'delay', wet: 0.6, param: 0.65 },
  { keyword: '映画的', type: 'delay', wet: 0.6, param: 0.65 },
  { keyword: 'ノワール', type: 'delay', wet: 0.55, param: 0.55 },
  { keyword: 'レトロフューチャー', type: 'delay', wet: 0.55, param: 0.55 },
  { keyword: 'ぐるぐる', type: 'delay', wet: 0.6, param: 0.55 },
  { keyword: '繰り返し', type: 'delay', wet: 0.5, param: 0.5 },
  { keyword: 'リピート', type: 'delay', wet: 0.5, param: 0.5 },
  { keyword: 'ループ', type: 'delay', wet: 0.6, param: 0.6 },
  { keyword: 'タップディレイ', type: 'delay', wet: 0.5, param: 0.4 },
  { keyword: 'ステップ', type: 'delay', wet: 0.5, param: 0.4 },
  { keyword: 'タンバリン', type: 'delay', wet: 0.4, param: 0.3 },

  // ── SATURATION (34) ──────────────────────────────────────────────
  { keyword: 'ファズ', type: 'saturation', wet: 0.8, param: 0.85 },
  { keyword: 'ウォーム', type: 'saturation', wet: 0.4, param: 0.3 },
  { keyword: 'ブースト', type: 'saturation', wet: 0.3, param: 0.5 },
  { keyword: 'クランチ', type: 'saturation', wet: 0.6, param: 0.55 },
  { keyword: 'オーバードライブ', type: 'saturation', wet: 0.7, param: 0.7 },
  { keyword: 'ディストーション', type: 'saturation', wet: 0.85, param: 0.85 },
  { keyword: 'メタル', type: 'saturation', wet: 0.9, param: 0.9 },
  { keyword: 'グランジ', type: 'saturation', wet: 0.7, param: 0.6 },
  { keyword: 'ロック', type: 'saturation', wet: 0.6, param: 0.5 },
  { keyword: 'ハードロック', type: 'saturation', wet: 0.75, param: 0.7 },
  { keyword: 'パンク', type: 'saturation', wet: 0.7, param: 0.6 },
  { keyword: 'ブルース', type: 'saturation', wet: 0.45, param: 0.4 },
  { keyword: 'チューブ', type: 'saturation', wet: 0.5, param: 0.4 },
  { keyword: '真空管', type: 'saturation', wet: 0.5, param: 0.4 },
  { keyword: 'アンプ', type: 'saturation', wet: 0.55, param: 0.5 },
  { keyword: 'マーシャル', type: 'saturation', wet: 0.65, param: 0.6 },
  { keyword: 'フェンダー', type: 'saturation', wet: 0.45, param: 0.4 },
  { keyword: 'アナログ', type: 'saturation', wet: 0.45, param: 0.4 },
  { keyword: 'テープ歪み', type: 'saturation', wet: 0.5, param: 0.45 },
  { keyword: 'クリーミー', type: 'saturation', wet: 0.4, param: 0.35 },
  { keyword: 'シルキー', type: 'saturation', wet: 0.35, param: 0.3 },
  { keyword: 'リッチ', type: 'saturation', wet: 0.5, param: 0.5 },
  { keyword: '太い', type: 'saturation', wet: 0.55, param: 0.6 },
  { keyword: '厚い', type: 'saturation', wet: 0.55, param: 0.55 },
  { keyword: '80年代', type: 'saturation', wet: 0.6, param: 0.55 },
  { keyword: '80s', type: 'saturation', wet: 0.6, param: 0.55 },
  { keyword: '70年代', type: 'saturation', wet: 0.5, param: 0.45 },
  { keyword: '70s', type: 'saturation', wet: 0.5, param: 0.45 },
  { keyword: '60年代', type: 'saturation', wet: 0.45, param: 0.4 },
  { keyword: 'ザラザラ', type: 'saturation', wet: 0.65, param: 0.55 },
  { keyword: 'ガリガリ', type: 'saturation', wet: 0.7, param: 0.65 },
  { keyword: '焦げた', type: 'saturation', wet: 0.8, param: 0.8 },
  { keyword: '濃い', type: 'saturation', wet: 0.6, param: 0.6 },
  { keyword: 'ハイゲイン', type: 'saturation', wet: 0.85, param: 0.85 },
  { keyword: 'ローゲイン', type: 'saturation', wet: 0.3, param: 0.3 },
  { keyword: 'ジャンク', type: 'saturation', wet: 0.7, param: 0.7 },
  { keyword: 'ノイジー', type: 'saturation', wet: 0.7, param: 0.65 },

  // ── LOFI (41) ────────────────────────────────────────────────────
  { keyword: 'カセット', type: 'lofi', wet: 0.6, param: 0.5 },
  { keyword: 'ローバッテリー', type: 'lofi', wet: 0.8, param: 0.7 },
  { keyword: '8bit', type: 'lofi', wet: 0.9, param: 0.85 },
  { keyword: 'テープレコーダー', type: 'lofi', wet: 0.6, param: 0.5 },
  { keyword: 'オープンリール', type: 'lofi', wet: 0.55, param: 0.5 },
  { keyword: 'VHS', type: 'lofi', wet: 0.7, param: 0.6 },
  { keyword: 'ベータマックス', type: 'lofi', wet: 0.7, param: 0.6 },
  { keyword: 'MD', type: 'lofi', wet: 0.5, param: 0.45 },
  { keyword: 'ミニディスク', type: 'lofi', wet: 0.5, param: 0.45 },
  { keyword: 'ウォークマン', type: 'lofi', wet: 0.55, param: 0.5 },
  { keyword: 'ボイスメモ', type: 'lofi', wet: 0.6, param: 0.55 },
  { keyword: 'レコード', type: 'lofi', wet: 0.55, param: 0.45 },
  { keyword: 'ヴァイナル', type: 'lofi', wet: 0.55, param: 0.45 },
  { keyword: 'アナログレコード', type: 'lofi', wet: 0.55, param: 0.45 },
  { keyword: 'ノイズ', type: 'lofi', wet: 0.6, param: 0.55 },
  { keyword: 'ビットクラッシュ', type: 'lofi', wet: 0.85, param: 0.8 },
  { keyword: '16bit', type: 'lofi', wet: 0.6, param: 0.55 },
  { keyword: '12bit', type: 'lofi', wet: 0.7, param: 0.65 },
  { keyword: 'ファミコン', type: 'lofi', wet: 0.85, param: 0.85 },
  { keyword: 'ゲームボーイ', type: 'lofi', wet: 0.85, param: 0.85 },
  { keyword: 'チップチューン', type: 'lofi', wet: 0.85, param: 0.85 },
  { keyword: 'レトロゲーム', type: 'lofi', wet: 0.8, param: 0.8 },
  { keyword: '古いPC', type: 'lofi', wet: 0.7, param: 0.7 },
  { keyword: '留守電', type: 'lofi', wet: 0.85, param: 0.6 },
  { keyword: '留守番電話', type: 'lofi', wet: 0.85, param: 0.6 },
  { keyword: 'ファクス', type: 'lofi', wet: 0.85, param: 0.7 },
  { keyword: 'ラジカセ', type: 'lofi', wet: 0.6, param: 0.5 },
  { keyword: 'ブラウン管', type: 'lofi', wet: 0.6, param: 0.55 },
  { keyword: 'ローファイヒップホップ', type: 'lofi', wet: 0.7, param: 0.6 },
  { keyword: 'ヴェイパーウェイブ', type: 'lofi', wet: 0.7, param: 0.65 },
  { keyword: 'チルホップ', type: 'lofi', wet: 0.6, param: 0.55 },
  { keyword: 'ノスタルジック', type: 'lofi', wet: 0.55, param: 0.5 },
  { keyword: 'レトロ', type: 'lofi', wet: 0.55, param: 0.5 },
  { keyword: '90年代', type: 'lofi', wet: 0.7, param: 0.6 },
  { keyword: '90s', type: 'lofi', wet: 0.7, param: 0.6 },
  { keyword: 'ガサガサ', type: 'lofi', wet: 0.7, param: 0.6 },
  { keyword: 'プチプチ', type: 'lofi', wet: 0.65, param: 0.5 },
  { keyword: 'パチパチ', type: 'lofi', wet: 0.65, param: 0.5 },
  { keyword: 'ブチブチ', type: 'lofi', wet: 0.7, param: 0.6 },
  { keyword: '古い', type: 'lofi', wet: 0.55, param: 0.5 },
  { keyword: '昭和', type: 'lofi', wet: 0.65, param: 0.55 },
  { keyword: '平成初期', type: 'lofi', wet: 0.65, param: 0.55 },
  { keyword: 'AM録音', type: 'lofi', wet: 0.8, param: 0.7 },
  { keyword: 'モノラル', type: 'lofi', wet: 0.5, param: 0.45 },
];

/**
 * Combined dictionary (chip + extended). Used by Phase 2B+ for text input
 * matching. Phase 2A consumers should import `chipKeywords` directly.
 */
export const presetDictionary: readonly PresetEntry[] = [...chipKeywords, ...extendedKeywords];

/**
 * Exact-match lookup (case-insensitive). Used for Phase 2A chip taps and as
 * the first lookup tier inside `inferPreset`.
 */
export function findPresetByKeyword(keyword: string): PresetEntry | undefined {
  const k = keyword.trim().toLowerCase();
  return presetDictionary.find((e) => e.keyword.toLowerCase() === k);
}

/**
 * Substring fallback. When a user types a longer phrase like "ホールに響く感じ"
 * or "アシッドっぽい感じ", we look for the longest dictionary keyword that
 * appears as a substring of the input.
 *
 * Why longest first: avoids the "AMラジオ" / "ラジオ" ambiguity and prefers
 * the more specific entry. "AMラジオの音にして" matches "AMラジオ", not "ラジオ".
 *
 * Returns undefined when no keyword is contained in the input.
 *
 * Trade-off: this can pick a chip-tier preset for a multi-modifier phrase
 * (e.g. "暗い水中" picks "水中" filter and ignores "暗い"). Acceptable for
 * Phase 2B because the LLM tier handles the more complex cases. The
 * substring tier is the "instant 80%" net.
 */
export function findPresetBySubstring(input: string): PresetEntry | undefined {
  const haystack = input.trim().toLowerCase();
  if (!haystack) return undefined;
  let best: PresetEntry | undefined;
  for (const entry of presetDictionary) {
    const needle = entry.keyword.toLowerCase();
    if (haystack.includes(needle)) {
      if (!best || needle.length > best.keyword.length) best = entry;
    }
  }
  return best;
}
