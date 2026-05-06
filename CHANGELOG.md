# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0.3] - 2026-05-05

### Fixed
- WebLLM weight downloads were still blocked after v0.2.0.1: HuggingFace redirects model weight shards to its Xet CDN (`cas-bridge.xethub.hf.co`), which the CSP did not whitelist. Added `https://*.hf.co` to `connect-src` so the redirected GET requests succeed and the 300MB download completes.

## [0.2.0.2] - 2026-05-05

### Fixed
- AI 提案 toggle no longer hangs at 0% on devices that report `navigator.gpu` but cannot supply a usable WebGPU adapter (e.g. headless Chromium, sandboxed environments, some virtual machines). Three new failure paths surface real errors to the UI instead of letting the download spin forever:
  - **Adapter pre-check** (10s timeout): runs `gpu.requestAdapter()` before starting the 300MB download. Fails fast with "GPU アダプタが取得できません…" if null.
  - **Stall watchdog** (60s): if the WebLLM progress callback stops firing for a full minute, abort with "ダウンロードが進みません…" so the user can check their network.
  - **Full load timeout** (5 min): hard ceiling for the entire load. Aborts with "読み込みが時間切れになりました…" if something deeper hangs.
- All three errors flow through the existing `useWebLLM` error state, surfacing the message in the Settings AI 提案 row and re-enabling the toggle for retry.

## [0.2.0.1] - 2026-05-05

### Fixed
- CSP was blocking WebLLM model downloads (`Refused to connect to 'https://huggingface.co/mlc-ai/...'`). Added `https://huggingface.co`, `https://*.huggingface.co`, and `https://raw.githubusercontent.com` to `connect-src`, plus `'wasm-unsafe-eval'` to `script-src` so the library can compile WASM modules at runtime. Without this, the AI 提案 toggle would lock at 0% indefinitely on production.

## [0.2.0.0] - 2026-05-05

### Added
- Phase 2B.1 foundation: WebLLM (Qwen2-0.5B-Instruct INT4) opt-in scaffolding. Settings sheet shows a new "🤖 AI 提案" row that detects WebGPU support, downloads the ~300MB model on opt-in, persists the choice in localStorage, and exposes engine state (idle / loading-with-progress / ready / error / unsupported) to consumers via the new `useWebLLM` hook.
- `src/ai/webllmClient.ts`: lazy-loaded WebLLM wrapper with WebGPU detection, model cache check, structured-output inference (Japanese vibe → `{type, wet, param}` JSON), and dictionary fallback for empty / malformed LLM output.
- `src/hooks/useWebLLM.ts`: React surface that auto-initializes the engine when the user has previously opted in, exposes loading progress, and provides `infer(vibe)` for downstream consumers.

### Changed
- `vite.config.js`: precache `globIgnores: ['**/lib-*.js']` so the lazy WebLLM chunk (~6MB) is not forced into the SW install footprint. Users who never opt into AI never download it.

### Notes
- Phase 2B.1 ships only the engine + Settings opt-in. The "他の言葉" chip + LCD-style vibe input that consumes `infer()` lands in Phase 2B.2.
- iOS Safari < 26 lacks WebGPU; the toggle gracefully degrades to a disabled state with explanation.

## [0.1.2.2] - 2026-05-05

### Added
- Unit tests for `presetDictionary` (12 contract assertions: chip count, type coverage, lookup correctness, case-insensitivity, no-duplicates).
- Component tests for `EffectVibeChips` (17 tests: rendering, chip-tap with motion, prefers-reduced-motion path, manual interaction clears active state).
- Manual test procedure for verifying `prefers-reduced-motion` on real iPad / iPhone / Android, archived in `.gstack/qa-reports/reduce-motion-manual-test.md`.

Test count: 75 → 104 (+29).

## [0.1.2.1] - 2026-05-05

### Fixed
- Service worker now auto-applies new versions without requiring users to tap an "更新" button. Previously, users who dismissed or ignored the update toast would stay on the cached old bundle indefinitely (this caused the v0.1.2.0 chips to appear missing on devices that had visited before). With autoUpdate + clientsClaim + skipWaiting, the new SW seizes control on activation and the new bundle is served on the next page load.
- Reduced SW update polling from 1 hour to 30 minutes so deploys propagate to long-lived sessions (e.g. an iPad PWA left open) within half an hour.

### Removed
- UpdateToast "新バージョンあります" prompt and its associated `usePWA` hook surface (`needRefresh` / `applyUpdate` / `dismissUpdate`). Updates are now silent and automatic.

## [0.1.2.0] - 2026-05-05

### Added
- EffectVibeChips: 12 Japanese vibe keyword chips above the effect type row (水中 / ローファイ / 広い / 狭い / 歪み / テープ / クリア / 電話 / ヴィンテージ / アシッド / 深い / 軽い). One tap applies a preset {type, wet, param} with a 250ms ease-out knob ramp so users learn the mapping by watching the knobs move.
- `presetDictionary.ts` with 30 keyword → effect mappings (12 surfaced as chips, 18 reserved for Phase 2B text input).
- aria-live announce of resulting type/wet/param values for 1.5s after each chip tap.
- Manual knob interaction now auto-clears the active chip highlight (drift detection).

### Changed
- EffectPanel header description now overrides briefly with the chip-applied vibe summary, then reverts to the static effect description.

## [0.1.1.0] - 2026-05-05

### Added
- BPM stepper buttons (±1) on transport bar for fine-grained tempo control
- Settings panel now visible on all viewport widths (desktop, tablet, mobile)

### Fixed
- Transport bar display settings no longer hidden on landscape mode

### Changed
- Updated design system documentation for BPM stepper styling
