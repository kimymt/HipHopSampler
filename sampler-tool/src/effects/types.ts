/**
 * Effect engine types.
 *
 * Each effect exposes:
 *   - input: the AudioNode that callers connect their source to
 *   - output: the AudioNode that connects to the next stage (master gain)
 *   - setWet(0..1): dry/wet mix
 *   - setParam(0..1): the single user-facing knob (cutoff / decay / amount / etc.)
 *   - dispose(): release any persistent nodes (timers, worklets)
 *
 * The 0..1 normalized parameter range maps differently per-effect (e.g. for
 * filter cutoff it's an exponential frequency mapping). This keeps the UI
 * generic — one knob always reads 0..1.
 */
export interface EffectNode {
  input: AudioNode;
  output: AudioNode;
  setWet(v: number): void;
  setParam(v: number): void;
  dispose(): void;
}

export type EffectType = 'none' | 'reverb' | 'delay' | 'filter' | 'saturation' | 'lofi';

export interface EffectMeta {
  type: EffectType;
  label: string;
  paramLabel: string;
  description: string;
}

// Descriptions: keep one consistent shape across all effects — a short
// "what it does" sentence + the direction the knob takes (低い → 高い).
// Avoid raw numeric anchors like "0=..., 1=..." since the slider already
// shows percentages.
export const EFFECT_META: Record<EffectType, EffectMeta> = {
  none: {
    type: 'none',
    label: 'NONE',
    paramLabel: '',
    description: 'エフェクトなし',
  },
  reverb: {
    type: 'reverb',
    label: 'REVERB',
    paramLabel: 'SIZE',
    description: '部屋の広がり (狭い → 広い)',
  },
  delay: {
    type: 'delay',
    label: 'DELAY',
    paramLabel: 'TIME',
    description: 'やまびこの間隔 (短い → 長い)',
  },
  filter: {
    type: 'filter',
    label: 'FILTER',
    paramLabel: 'CUTOFF',
    description: '音色を変える (モコモコ → ハッキリ)',
  },
  saturation: {
    type: 'saturation',
    label: 'SATURATE',
    paramLabel: 'DRIVE',
    description: 'アナログ風の歪み (薄い → 濃い)',
  },
  lofi: {
    type: 'lofi',
    label: 'LO-FI',
    paramLabel: 'CRUSH',
    description: 'カセットテープ風の劣化 (弱い → 強い)',
  },
};

export const EFFECT_TYPES: EffectType[] = ['none', 'reverb', 'delay', 'filter', 'saturation', 'lofi'];

/**
 * Persisted FX state. Keep simple and serializable.
 */
export interface FxState {
  type: EffectType;
  wet: number;   // 0..1
  param: number; // 0..1
}

export const DEFAULT_FX_STATE: FxState = {
  type: 'none',
  wet: 0.4,
  param: 0.5,
};
