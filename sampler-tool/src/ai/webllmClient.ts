/**
 * Phase 2B WebLLM client.
 *
 * Wraps `@mlc-ai/web-llm` with a tiny state machine + lazy loader. The library
 * is **dynamically imported** so users who never opt into AI never pay the
 * ~1MB TS-side bundle cost (separate from the ~300MB model weights, which are
 * downloaded by the library itself on first init).
 *
 * Why Qwen2-0.5B-Instruct-q4f16_1:
 *   - INT4 quantized → ~300MB download, fits the "soft cap" we promise users
 *   - Multilingual including Japanese, which is the primary input language
 *   - Fast on consumer GPUs (40-180 tok/s on M-series Macs and Pixel-class
 *     Android), keeps the chip-tap feel even with LLM in the loop
 *
 * The library caches model weights in IndexedDB / Cache API automatically;
 * subsequent loads are instant. We only show "downloading…" UI on first init.
 */

import {
  findPresetByKeyword,
  findPresetBySubstring,
  type PresetEntry,
} from '../effects/presetDictionary';
import type { EffectType, FxState } from '../effects/types';

// Public state surface. Consumers (useWebLLM hook + Settings UI) drive UX off this.
export type WebLLMState =
  | { status: 'unsupported'; reason: string }
  | { status: 'idle' }
  | { status: 'loading'; progress: number; text: string }
  | { status: 'ready' }
  | { status: 'error'; message: string };

export interface VibeInferenceResult {
  /** Effect type chosen. */
  type: EffectType;
  /** Wet 0..1 */
  wet: number;
  /** Param 0..1 */
  param: number;
  /**
   * Where the result came from:
   * - 'dictionary': exact keyword hit in presetDictionary (Phase 2A, no LLM call)
   * - 'llm': LLM produced a valid JSON output for a novel phrase
   * - 'llm-fallback': LLM was tried but failed/malformed; we fell back to dictionary
   * UI uses this to label the source ("AI 提案" vs "辞書一致").
   */
  source: 'dictionary' | 'llm' | 'llm-fallback';
  /** Optional human-readable note (e.g. dictionary description). */
  note?: string;
}

/** Single Qwen variant we ship; pinning here keeps bundle/install reproducible. */
export const WEBLLM_MODEL_ID = 'Qwen2-0.5B-Instruct-q4f16_1-MLC';

const LS_KEY_OPT_IN = 'sampler.ai.webllm.optIn';

// Feature detection. Cheap, synchronous, no library import — safe to run on
// every render. Returns the reason when unsupported so UI can explain.
export type WebLLMSupportResult =
  | { supported: true }
  | { supported: false; reason: string };

export const detectWebLLMSupport = (): WebLLMSupportResult => {
  if (typeof navigator === 'undefined') return { supported: false, reason: 'no-navigator' };
  // WebGPU is the hard requirement. iOS Safari < 26 lacks it; older Android
  // Chrome too. Detection here is non-launching — we never call requestAdapter
  // until the user actually opts in (it can prompt for hardware permission).
  const gpu = (navigator as Navigator & { gpu?: unknown }).gpu;
  if (!gpu) return { supported: false, reason: 'WebGPU 非対応 (Chrome / Android Chrome / Safari 26+ で利用可能)' };
  return { supported: true };
};

export const getStoredOptIn = (): boolean => {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(LS_KEY_OPT_IN) === '1';
};

export const setStoredOptIn = (on: boolean) => {
  if (typeof localStorage === 'undefined') return;
  if (on) localStorage.setItem(LS_KEY_OPT_IN, '1');
  else localStorage.removeItem(LS_KEY_OPT_IN);
};

// Singleton engine ref — multiple calls to load() share one engine.
type AnyEngine = {
  chatCompletion: (req: unknown) => Promise<unknown>;
  unload?: () => Promise<void>;
};
let enginePromise: Promise<AnyEngine> | null = null;
let engine: AnyEngine | null = null;

/** Adapter pre-check timeout. iOS Safari occasionally hangs the call. */
const ADAPTER_CHECK_TIMEOUT_MS = 10_000;
/** Full load timeout — must cover 300MB download on slow mobile (~5 min @ 1 MB/s). */
const FULL_LOAD_TIMEOUT_MS = 5 * 60 * 1000;
/** Stall watchdog — if no progress callback fires for this long during load, abort. */
const STALL_TIMEOUT_MS = 60_000;

const promiseTimeout = <T>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(label)), ms),
    ),
  ]);

/**
 * Verify a WebGPU adapter is actually usable. detectWebLLMSupport() only
 * checks `navigator.gpu` exists — but the browser may expose the namespace
 * without a working adapter (headless Chromium on macOS, machines without a
 * GPU, sandbox restrictions). This call is async and may prompt for hardware
 * access on some browsers, so we only run it when the user has opted in.
 */
const verifyAdapter = async (): Promise<void> => {
  type GPULike = { requestAdapter: () => Promise<unknown> };
  const gpu = (navigator as Navigator & { gpu?: GPULike }).gpu;
  if (!gpu) {
    throw new Error('WebGPU が利用できません。Chrome / Edge / Android Chrome をお試しください。');
  }
  let adapter: unknown;
  try {
    adapter = await promiseTimeout(
      gpu.requestAdapter(),
      ADAPTER_CHECK_TIMEOUT_MS,
      'GPU 確認がタイムアウトしました',
    );
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? `GPU の準備に失敗: ${err.message}`
        : 'GPU の準備に失敗しました',
    );
  }
  if (!adapter) {
    throw new Error(
      'GPU アダプタが取得できません。デスクトップ Chrome / Edge をお試しください (一部の環境では WebGPU が無効化されています)。',
    );
  }
};

/**
 * Initialize the engine. Idempotent: subsequent calls return the same engine.
 * Progress callback fires for download bytes and shader compile stages.
 *
 * The dynamic import is intentional — keeps the @mlc-ai/web-llm code out of
 * the main app bundle for users who never enable AI suggestions.
 *
 * Three failure modes the caller can rely on:
 *   1. Adapter pre-check fails → throws within ~10s with a usable message
 *   2. Stall during load (no progress for 60s) → throws with stall message
 *   3. Total load exceeds 5 min → throws with timeout message
 *
 * Without these, a missing GPU adapter or stuck download would leave the
 * UI hanging at "0%" indefinitely (caught in production verification of
 * v0.2.0.0 on a headless Chromium).
 */
export const loadWebLLM = async (
  onProgress?: (progress: number, text: string) => void,
): Promise<AnyEngine> => {
  if (engine) return engine;
  if (enginePromise) return enginePromise;

  enginePromise = (async () => {
    // 1. Verify adapter BEFORE downloading 300MB. Fast-fail path.
    await verifyAdapter();

    // 2. Stall watchdog: each progress callback resets the timer. If 60s pass
    //    with no progress, the inner promise rejects.
    let lastProgressAt = Date.now();
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    const stallController: { rejected: boolean; rejectFn?: (e: Error) => void } = { rejected: false };

    const stallPromise = new Promise<never>((_, reject) => {
      stallController.rejectFn = reject;
      const tick = () => {
        if (stallController.rejected) return;
        const elapsed = Date.now() - lastProgressAt;
        if (elapsed >= STALL_TIMEOUT_MS) {
          stallController.rejected = true;
          reject(new Error('ダウンロードが進みません。ネットワークを確認してから再試行してください。'));
          return;
        }
        stallTimer = setTimeout(tick, Math.max(1000, STALL_TIMEOUT_MS - elapsed));
      };
      stallTimer = setTimeout(tick, STALL_TIMEOUT_MS);
    });

    // 3. Late import so the library never enters the main chunk.
    const webllm = await import('@mlc-ai/web-llm');
    const enginePromiseInner = webllm.CreateMLCEngine(WEBLLM_MODEL_ID, {
      initProgressCallback: (report) => {
        lastProgressAt = Date.now();
        // report: { progress: 0..1, text: string, timeElapsed: number }
        onProgress?.(report.progress, report.text);
      },
    });

    // 4. Race engine init against stall + full timeout. Whichever loses, we
    //    bail out and surface a real error to the UI instead of hanging.
    try {
      const created = await Promise.race([
        enginePromiseInner,
        stallPromise,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('読み込みが時間切れになりました。ページを再読み込みしてください。')),
            FULL_LOAD_TIMEOUT_MS,
          ),
        ),
      ]);
      engine = created as unknown as AnyEngine;
      return engine;
    } finally {
      stallController.rejected = true;
      if (stallTimer) clearTimeout(stallTimer);
    }
  })().catch((err) => {
    enginePromise = null; // allow retry on next load() call
    throw err;
  });

  return enginePromise;
};

/**
 * Check whether the model weights are already cached locally. Lets UI show
 * "Ready (no download needed)" instead of "Downloading 300MB…" on second
 * launch. Implemented via dynamic import so non-opted-in users don't pay
 * the bundle cost just to render Settings.
 */
export const isWebLLMCached = async (): Promise<boolean> => {
  try {
    const webllm = await import('@mlc-ai/web-llm');
    return await webllm.hasModelInCache(WEBLLM_MODEL_ID);
  } catch {
    return false;
  }
};

// ---------- Inference ----------

/**
 * System prompt for vibe → preset inference.
 *
 * We use few-shot from the dictionary so the model knows the {type, wet, param}
 * shape and the magnitude conventions ("広い" = high reverb size, "クリア" = high
 * filter cutoff, etc.). Output is constrained to JSON via response_format.
 */
const buildSystemPrompt = (): string => {
  const types: EffectType[] = ['none', 'reverb', 'delay', 'filter', 'saturation', 'lofi'];
  // 6 representative few-shot examples drawn from chipKeywords (no need to
  // include all 30 — the model generalizes from a handful).
  const examples = [
    { keyword: '水中', type: 'filter', wet: 0.7, param: 0.2 },
    { keyword: '広い', type: 'reverb', wet: 0.6, param: 0.85 },
    { keyword: '歪み', type: 'saturation', wet: 0.7, param: 0.7 },
    { keyword: 'ローファイ', type: 'lofi', wet: 0.7, param: 0.6 },
    { keyword: 'やまびこ', type: 'delay', wet: 0.5, param: 0.5 },
    { keyword: '電話', type: 'filter', wet: 0.9, param: 0.5 },
  ];
  return [
    'あなたは音楽プロデューサ補助 AI です。日本語の擬音・形容詞・場所名を音響エフェクトに変換します。',
    '',
    `エフェクトタイプは次のうち1つを選びます: ${types.join(', ')}`,
    '- reverb: 残響 (param=サイズ、低い→狭い、高い→広い)',
    '- delay: やまびこ (param=間隔、低い→短い、高い→長い)',
    '- filter: 音色変化 (param=ローパスのカットオフ、低い→こもる、高い→クリア)',
    '- saturation: 歪み (param=強さ)',
    '- lofi: テープ・ビット劣化 (param=強さ)',
    '- none: エフェクトを使わないとき',
    '',
    'wet は 0.0〜1.0 のドライ/ウェット比率。param も 0.0〜1.0。',
    '',
    '入力例と望ましい出力:',
    ...examples.map(
      (e) => `「${e.keyword}」 → {"type":"${e.type}","wet":${e.wet},"param":${e.param}}`,
    ),
    '',
    '必ず JSON だけを返してください。説明文・前置き・コードフェンス禁止。',
    'スキーマ: {"type": <上記のいずれか>, "wet": <0..1>, "param": <0..1>}',
  ].join('\n');
};

const SYSTEM_PROMPT = buildSystemPrompt();

const VALID_TYPES = new Set<EffectType>(['none', 'reverb', 'delay', 'filter', 'saturation', 'lofi']);
const clamp01 = (n: unknown): number | null => {
  if (typeof n !== 'number' || Number.isNaN(n)) return null;
  return Math.max(0, Math.min(1, n));
};

/**
 * Run inference on a vibe phrase. Falls back to dictionary lookup when the
 * model is unavailable, errors, or returns malformed JSON. Returns null only
 * if neither path produces a valid preset (truly unmatchable input).
 */
export const inferPreset = async (
  vibe: string,
): Promise<VibeInferenceResult | null> => {
  const trimmed = vibe.trim();
  if (!trimmed) return null;

  // 1. Exact dictionary hit short-circuits. Phase 2A path: zero latency, zero
  //    LLM dependency.
  const exact = findPresetByKeyword(trimmed);
  if (exact) {
    return {
      type: exact.type,
      wet: exact.wet,
      param: exact.param,
      source: 'dictionary',
      note: exact.description,
    };
  }

  // 1.5. Substring fallback. Catches natural phrasing like "ホールに響く感じ"
  //      → matches "ホール" → reverb. Still instant; saves an LLM round-trip
  //      for the common case where the user wraps a known keyword in
  //      conversational filler ("〜っぽく", "〜な感じ", "〜にして").
  const substring = findPresetBySubstring(trimmed);
  if (substring) {
    return {
      type: substring.type,
      wet: substring.wet,
      param: substring.param,
      source: 'dictionary',
      note: substring.description,
    };
  }

  // 2. LLM path. If engine isn't loaded yet, fail open to dictionary fuzzy
  //    fallback (currently no fuzzy matching — returns null. Phase 2B.2 may
  //    add Levenshtein over dictionary keys before returning null).
  if (!engine) return fallbackToDictionary(trimmed);

  // 30s hard ceiling. Qwen2-0.5B should respond in 1-3s on consumer GPUs;
  // anything beyond ~10s means the engine is wedged. Without this, a stuck
  // chatCompletion would leave the LCD input stuck on "AIが解釈中…" forever.
  const INFERENCE_TIMEOUT_MS = 30_000;

  try {
    // NOTE: We intentionally do NOT pass response_format here.
    //
    // WebLLM 0.2.83's grammar compiler (CompileJSONSchema) crashes with
    // "Cannot pass non-string to std::string" when response_format is set
    // to {type: 'json_object'} without an explicit stringified `schema`.
    // The crash happens on the C++ side via emscripten bindings and the
    // error doesn't reliably propagate back through the await chain — the
    // chatCompletion promise hangs instead of rejecting, which is what
    // pinned the LCD input on "AIが解釈中…" for 60s+ in the v0.3.0.0 ship.
    //
    // The system prompt + few-shot already constrains the output to a
    // JSON-only shape, and parsePreset below tolerates markdown fences,
    // leading whitespace, and trailing prose. For Qwen2-0.5B with 6 few-
    // shot examples, JSON compliance is reliable enough that grammar
    // enforcement isn't worth the risk of a 60s hang.
    const completion = await promiseTimeout(
      engine.chatCompletion({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `「${trimmed}」` },
        ],
        temperature: 0.2, // low temperature → consistent extraction
        max_tokens: 64,
      }),
      INFERENCE_TIMEOUT_MS,
      '推論がタイムアウトしました',
    );

    const text = extractContent(completion);
    if (!text) return fallbackToDictionary(trimmed);

    const parsed = parsePreset(text);
    if (!parsed) return fallbackToDictionary(trimmed);

    return { ...parsed, source: 'llm' as const };
  } catch (err) {
    console.warn('[WebLLM] inference failed:', err);
    return fallbackToDictionary(trimmed);
  }
};

const extractContent = (completion: unknown): string | null => {
  if (!completion || typeof completion !== 'object') return null;
  const c = completion as { choices?: Array<{ message?: { content?: string } }> };
  return c.choices?.[0]?.message?.content ?? null;
};

const parsePreset = (raw: string): { type: EffectType; wet: number; param: number } | null => {
  // Strip markdown fences if the model decided to add them despite the prompt.
  const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as { type?: unknown; wet?: unknown; param?: unknown };
  const type = obj.type as EffectType;
  if (!VALID_TYPES.has(type)) return null;
  const wet = clamp01(obj.wet);
  const param = clamp01(obj.param);
  if (wet === null || param === null) return null;
  return { type, wet, param };
};

const fallbackToDictionary = (vibe: string): VibeInferenceResult | null => {
  // Try exact first (cheap), then substring. Substring catches phrases like
  // "ホールに響く感じ" that the LLM may have garbled into invalid JSON.
  const hit = findPresetByKeyword(vibe) ?? findPresetBySubstring(vibe);
  if (!hit) return null;
  return {
    type: hit.type,
    wet: hit.wet,
    param: hit.param,
    source: 'llm-fallback',
    note: hit.description,
  };
};

/** Helper for tests / debugging — converts a result into an FxState patch. */
export const resultToFxPatch = (r: VibeInferenceResult): Pick<FxState, 'type' | 'wet' | 'param'> => ({
  type: r.type,
  wet: r.wet,
  param: r.param,
});

// Test seam: lets unit tests inject a mock engine without touching localStorage
// or attempting the real dynamic import.
export const __setEngineForTest = (mock: AnyEngine | null) => {
  engine = mock;
  enginePromise = mock ? Promise.resolve(mock) : null;
};
