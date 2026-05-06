# Changelog

All notable changes to this project will be documented in this file.

## [0.7.1.0] - 2026-05-06

### Added
- **300-entry vibe dictionary** (Phase 2B.4 — re-merged on top of v0.7.0.0). Grew `extendedKeywords` from 25 → 291 entries, total dictionary 37 → 303. The substring matcher means each new fragment instantly covers dozens of natural-language wrappers ("〜っぽく", "〜な感じ", "〜にして"). Distribution by type: reverb 81 + filter 71 + delay 42 + saturation 36 + lofi 41.
- New coverage areas: indoor spaces (寝室, バスルーム, リビング, カフェ, レストラン, ジム, 体育館, コンサートホール, 劇場, 映画館, 工場, 倉庫, 駅, 空港), religious (大聖堂, チャペル, 修道院, 神社, 寺), outdoor (山, 谷, 渓谷, 森, 海岸, 砂漠, 公園, 路地, 屋上, 田舎, 滝), abstract (宇宙, 銀河, 異次元, 夢, 天国, 地獄, 地下), genres (アンビエント, シューゲイザー, ドリームポップ, オーケストラ, クラシック, ゴスペル, テクノ, ハウス, トリップホップ, レゲエ, メタル, グランジ, ロック, パンク, ブルース, レトロゲーム, チップチューン, ヴェイパーウェイブ, チルホップ), through-barriers (壁越し, ドア越し, 窓越し, ガラス越し, カーテン越し, 厚い壁, 布越し, マイク越し), phone/radio (古い電話, 国際電話, 携帯電話, 公衆電話, インターホン, 短波, FMラジオ, アナウンス, 駅のアナウンス, 店内放送, ヘリコプター, パトカー, メガホン, 拡声器), vehicles (電車の中, 地下鉄, 飛行機), gear (チューブ, 真空管, アンプ, マーシャル, フェンダー, テープエコー, アナログエコー, ロランド, スペースエコー), eras (60年代, 70年代, 80年代, 90年代 with 70s/80s/90s aliases, 昭和, 平成初期), retro tech (VHS, ベータマックス, MD, ウォークマン, ボイスメモ, レコード, ヴァイナル, ファミコン, ゲームボーイ, 古いPC, 留守電, ファクス, ラジカセ, ブラウン管), and onomatopoeia (ピヨピヨ, キンキン, シャリシャリ, モコモコ, ザラザラ, ガリガリ, ガサガサ, プチプチ, パチパチ, ブチブチ, ぐるぐる, ふわふわ).

### Changed
- Moved ベル / 鈴 / 鐘 from delay to reverb. Bell sustain reads as residual reverb tail, not discrete echoes.
- Moved 滝 from filter to reverb. Waterfall sound is dominated by spatial wash, not high-frequency loss.

### Why ship this on top of Reference Mode
"人に見せる段階" になり、AI 提案の hit 率が薄いと「結局この機能使えないね」になる。substring matcher のおかげで 291 件追加が数千フレーズのカバレッジに展開する。bundle 影響 +14KB precache のみ。

## [0.7.0.0] - 2026-05-06

### Added
- **📚 リファレンスモード — Phase 3 B+C: 保存 + テンポ適用**. 解析結果を IndexedDB に保存し、別セッションで呼び出してアプリ全体の BPM に適用できるようになりました。これでリファレンス → 制作行為への直接的な接続が完成。
  - **「💾 解析を保存」**: ready 状態に追加。専用ダイアログで自分が付ける名前を入力 (例「Track A の感じ」)。同意文「保存される内容: BPM 値・ビート位置の数値配列・あなたが付けた名前 / 保存されない内容: 楽曲ファイル本体・元のファイル名・波形データ」を毎回表示。
  - **「🎯 このテンポをアプリに適用」**: ready 状態と保存済み解析の両方に表示。タップでメイントランスポートの BPM を一発で同期。BPM ステッパー・ディレイ tempo sync・シーケンサスケジューラがすべて追従。
  - **保存済み解析の一覧 + 詳細ビュー**: idle 状態でファイルピッカーの上に並び、タップで詳細へ。詳細ビューには永続的な disclaimer (「元の楽曲ファイルは含まれていないため、波形は表示されません」) と削除ボタン。

### 法的ガードレール (Phase 1 から継承・新規 surface)
- 専用 IndexedDB データベース `reference-analyses` を新設 — `hip-hop-sampler` (ユーザーのサンプル) とは物理分離。saved analysis レコードは `{id, name, bpm, offsetSec, beatPositions, durationSec, createdAt}` のみで、AudioBuffer / 元ファイル名 / 波形データ / アーティスト情報は **絶対に書き込まない**。
- 保存ダイアログでも詳細ビューでも、何が保存され何が保存されないかを文章で明示。
- 既存の export ガードレール TODO (PR #44) と整合: 将来エクスポート機能を実装する際、saved analysis レコード全体を「派生数値データ」として扱い、必ず同意ゲートを通すこと。

### 新規ファイル
- `src/utils/referenceStore.ts`: IndexedDB CRUD (save/list/delete + UUID 生成)
- `src/hooks/useSavedAnalyses.ts`: React 状態 + 楽観的更新
- `src/components/SaveAnalysisDialog.tsx` + `.css`: 名前入力 + 同意文 + キャンセル/保存
- ReferenceMode 内に `SavedAnalysesList` + `SavedAnalysisView` サブコンポーネント追加

### 検証済 (browser preview)
- 90 BPM トラックを読み込み → 保存ダイアログで「Track A の感じ」と入力 → 保存
- 解除して idle に戻る → 「保存済みの解析」セクションに「Track A の感じ — 90 BPM · 8s」表示
- タップ → 詳細ビュー (BPM 90 / 長さ 0:08 / オフセット +0.00s / ビート位置数 12)
- アプリ BPM を 120 にセット → 「このテンポをアプリに適用」タップ → アプリ BPM が 90 に変化 (トランスポートバー反映確認)
- TypeScript clean、Vitest 122/122、Build clean (precache 419 → 431KB +12KB)

## [0.6.1.0] - 2026-05-06

### Added
- **📚 リファレンスモード — Phase 3a: 手動グリッド調整**. ビートグリッドを実際のダウンビートに合わせるための 4 つの操作を追加:
  - **波形をドラッグ** → グリッド全体が水平移動 (オフセット調整)
  - **`−` / `+` ボタン** → BPM を ±0.5 単位で微調整 (60-180 範囲でクランプ)
  - **`÷2` / `×2` ボタン** → 半分テンポ・倍テンポへの強制スナップ (アルゴリズムが間違えた時の救済)
  - **`再解析` ボタン** → 手動調整を破棄して自動推定値に戻す
- BPM は専用パネルで赤・大きく表示し、自動推定値と確度を別行に併記。「調整状態」メタカードが「自動推定そのまま」/「手動調整中」を切替表示。
- オフセット表示: 「`+2.03s · 波形をドラッグでグリッド移動`」(現在のオフセット秒数 + ヒント文)。リセットボタンは 0 以外のときだけ出現。

### Changed
- `buildBeatGrid(bpm, durationSec, offsetSec)` が新たな `offsetSec` パラメータを受け取り、走り戻り (offset から後ろに) ループで頭側のビートも埋めるように更新。負のオフセットも受け入れて [0, durationSec) 範囲にクランプ。
- ReferenceMode の ready 状態を `ReadyView` サブコンポーネントに分離。BPM・オフセットの内部 state は ReferenceMode 本体に置きつつ、表示・コントロールはサブコンポーネントへ。

### Tests
- `bpmEstimate.test.ts` に 3 件追加: 正のオフセット、走り戻りでヘッドを埋める動作、負オフセットのクランプ
- 計 122/122 passing

### 検証済 (browser preview)
- 90 BPM 入力で読み込み後、`+` を 4 回タップ → 92 / 「手動調整中」表示
- `÷2` 拒否 (45 < 60)、`×2` 拒否 (184 > 180)
- `再解析` で 90 に復帰、「自動推定そのまま」表示
- 波形を 120px ドラッグ (canvas 472px / duration 8s) → オフセット +2.03s (計算値と完全一致)
- リセットボタンで 0 に復帰

### 残課題 (Phase 3b 予定)
- 派生数値データ (BPM + ビート位置配列 + オフセット) のみの **軽量保存** (IndexedDB)。**音声データは絶対に保存しない** (ガードレール継承)。

## [0.6.0.0] - 2026-05-06

### Added
- **📚 リファレンスモード — Phase 2: 解析エンジン + 波形オーバーレイ**. 読み込んだ楽曲から BPM・ビート位置・打楽器ヒット位置を自動抽出し、Canvas 上に波形 + ビートグリッド (4 拍子目強調) + オンセットマーカーを描画。100% ローカル処理 (Phase 1 のガードレールを継承)、外部ライブラリ追加ゼロ。
- `src/utils/bpmEstimate.ts`: IOI ヒストグラム + 心理的好みテンポ曲線 (Parncutt 1994 ベースの Gaussian centered at 110 BPM σ=50) で 60-180 BPM 範囲の推定。半分テンポバイアス (120 BPM 入力で 60 を返す問題) を解消。
- `src/utils/analyzeReference.ts`: 既存 `detectOnsets` の上限を 5000 に引き上げ + BPM 推定 + ビートグリッド生成のオーケストレーター。同期処理だが 1 マイクロタスク yield してローディング UI が描画される機会を確保。
- `src/components/ReferenceWaveform.tsx`: HiDPI-aware Canvas で波形を描画。ビートグリッドは縦線 (4 拍ごとに明るく)、オンセットは上部の短い tick で表現。ResizeObserver で再描画。
- `useReferenceTrack` の状態機械に `analyzing` ステップ追加: idle → importing → analyzing → ready。

### Changed
- ReferenceMode パネル: ready 状態の表示を全面更新。BPM (赤・大きめ・確度 % 付き) を最優先で表示し、波形カードを 120px の高さで埋め込み、長さ・ビート数・ヒット数を補助情報に格下げ。

### 検証済 (browser preview)
- 90 BPM で生成した kick ループ → 検出値 90 BPM (確度 24%)、ビート 12 / ヒット 11
- 11 ユニットテスト (bpmEstimate.test.ts) — 60/75/90/120 BPM クリーン入力、±10ms ジッタ、200/40 BPM の半分・倍テンポ折り返し、空入力エラー
- 全 119 テスト pass、TypeScript clean、Build clean (precache 408 → 412KB)

### 残課題 (Phase 3 予定)
- ビートグリッドの **手動オフセット調整** (グリッドが実際のダウンビートとズレた時にユーザーが補正できる)
- 派生数値データ (BPM + ビート位置配列) のみの **軽量保存** (`localStorage` または `IndexedDB`)。**音声データは絶対に保存しない** (Phase 1 ガードレール継承)。

## [0.5.0.0] - 2026-05-06

### Added
- **📚 リファレンスモード — Phase 1**: load any audio file you like (MP3 / WAV / OGG / M4A / FLAC up to 100MB) and the app shows you its duration / sample rate / channels. Phase 2 (next sub-PR) will overlay the BPM and beat positions onto a waveform so beginners can see the structure of a track they want to learn from.
- Strict copyright guardrails baked into the import path (per dev brief §2):
  - **100% local** — file bytes never leave the browser. No upload, no fetch.
  - **No persistence** — the AudioBuffer lives only in React state. Closing the panel drops the reference for GC. There is no save path, by design.
  - **No DRM bypass** — DRM-protected files (and corrupt / unsupported codecs) are rejected with a clear "別のファイルでお試しください" message instead of attempting any workaround.
- Settings now exposes a "📚 リファレンスモード" entry that opens the panel. The panel header carries a permanent orange "REFERENCE MODE" tag plus a green disclaimer "学習用：解析データは端末内でのみ処理され、サーバーへ送信・保存されません" so the legal-defense affordance is visible at every step.

### Why this matters
Dogfooding feedback (2026-05-06): "操作自体は可能だが曲を完成させるまでには程遠い。具体的にこういうビートを作りたいという目的に対して、こういう手順でやるんだよというガイドが欲しい". Reference Mode is the answer: instead of a built-in demo beat, users load a track they already love and the app explains its structure. Phase 2 will surface BPM + beat positions; Phase 3 will let the user adjust the grid and save just the *numbers* (no audio) so the analysis becomes a re-usable template.

## [0.4.0.0] - 2026-05-06

### Added
- **🎁 スタータキット**: brand-new users no longer face an empty 4×4 grid. A button next to the PADS section header loads 8 synthesized hip-hop drum samples (kick / snare / closed hat / open hat / clap / 808 / rim / perc) into the first two rows in ~300ms. Generated client-side via Web Audio `OfflineAudioContext` (zero license risk, ~2KB code, no bundle bloat). The button hides automatically once all 8 starter pads are filled. Skips pads that already have a sample so user uploads are never clobbered.
- **🎵 サンプル音源を探す** in Settings: curated directory of 6 legally-usable sample sites (魔王魂, 効果音ラボ, D-elf, Pixabay, Freesound CC0 filter, r-loops Free) with license notes inline so users don't have to read each site's fine print to know what's safe.
- New utilities: `src/utils/synthDrums.ts` (8 drum-synth recipes), `src/utils/wavEncode.ts` (AudioBuffer → WAV Blob), `src/hooks/useStarterPack.ts` (orchestrates synthesis → loadSample pipeline).

### Why this matters
The persona reported "サンプル音源を探すのがすでに大変" — getting hip-hop-flavored audio is the largest barrier to making a first beat. The starter kit unblocks playback in zero seconds; the curated source list provides a path to richer / more authentic sounds for the second beat. Synth drums sound clean by default, which means the lofi/saturation/reverb chips have maximum visible impact when applied — テープ on a synth kick = instant boom-bap.

## [0.3.2.0] - 2026-05-06

### Changed
- **Renamed the free-form vibe chip from "もっと" back to "他の言葉"** (DESIGN.md §9.15 spec). The previous "もっと" rename was made for tighter horizontal scroll fit, but the original "他の言葉" framing is more accurate ("type something else") and reads better next to the kana presets.
- **Restyled the 他の言葉 chip with the LCD palette** (display-bg + display-red + Mono uppercase + a soft red glow). The chip now visually telegraphs "this is a doorway to the LCD input below" instead of looking like just another preset chip. Idle state is muted; hover and active states crank up the red glow to match the LCD readout aesthetic from the BPM display and bypass button.

### Added
- **Visible AI 提案 download progress.** The Settings row now renders a thin red-glowing progress bar that fills as WebLLM downloads weight shards. While the library's own progress callback is silent (initial manifest + tokenizer fetch typically sits at 0% for 5-15s on slower connections), the bar runs an indeterminate left-to-right shimmer so the user has visible motion. As soon as a real progress number arrives, the bar switches to a determinate fill.
- **Elapsed seconds counter** during download ("初回ダウンロード中… 0% · 12秒経過"). Even if the percentage stalls, the counter ticks every second so the user knows the load is still alive.
- `prefers-reduced-motion`: indeterminate shimmer is replaced with a static 35%-filled bar; the elapsed counter still ticks for non-visual feedback.

## [0.3.1.1] - 2026-05-06

### Fixed
- **iPhone header overflow.** The Settings ⚙ button (and therefore Tour, AI 提案, Install) was being pushed off-screen on iPhones because the transport bar tried to fit Logo + Play + BPM stepper + PADS counter + IDLE/PLAY LED + OfflineBadge + ⚙ on a single row. Hidden on mobile: PADS counter (already implicit from pad coloring), IDLE/PLAY LED (redundant with the play button itself), and OfflineBadge (now surfaced via the AI 提案 row in Settings if needed). Settings cog now stays inside the viewport on iPhone SE width (320px) and up.
- **Mobile pad-tap was force-opening the sample editor on every touch.** This made it impossible to actually perform on mobile — every attempt to play a beat would cover the pads with the BottomSheet. Mobile pad interaction is now: tap = play (no sheet), long-press 350ms = open editor. Section header text on mobile now reads "PADS · タップで再生 / 長押しで編集" so the gesture is discoverable without a tour step.

## [0.3.1.0] - 2026-05-06

### Added
- Substring fallback for vibe input. Phrases like "ホールに響く感じ", "アシッドっぽい", "トンネルの中で叫ぶ感じ" now match instantly without an LLM round-trip — the longest dictionary keyword contained in the input wins. Saves the user the 2-3s LLM wait for the common case where they wrap a known keyword in conversational filler.
- 7 new vocabulary entries to `extendedKeywords` chosen for substring coverage of natural reverb/filter phrasing: `ホール` / `響く` / `響き` / `反響` / `ライブハウス` (reverb), `トンネル` / `海中` (filter).

### Changed
- `inferPreset` lookup tiers are now: exact match → substring match → LLM → LLM-fallback (substring-aware). Previously: exact → LLM → exact-only fallback.
- TODO.md: documented Phase 2B.3 as the ongoing dictionary-enrichment phase. Real-user phrasing surfaced via QA gets folded into `extendedKeywords` over time; chip lineup stays untouched.

## [0.3.0.1] - 2026-05-06

### Fixed
- WebLLM inference would hang indefinitely on the first vibe submission ("AIが解釈中…" stuck for 60s+). Root cause: passing `response_format: { type: 'json_object' }` to WebLLM 0.2.83 triggers a grammar compiler crash (`Cannot pass non-string to std::string` in `CompileJSONSchema`) when no explicit stringified schema is supplied. The crash happens on the C++/emscripten side and never propagates back through the await chain, so the promise just never resolves. Removed `response_format` and rely on the few-shot system prompt + `parsePreset`'s markdown-fence-tolerant parser to enforce JSON shape.
- Added a 30s hard inference timeout so even unforeseen WebLLM hangs surface as "推論がタイムアウトしました" instead of pinning the LCD input on "AIが解釈中…" forever. Falls back to the dictionary path on timeout.

## [0.3.0.0] - 2026-05-06

### Added
- Phase 2B.2: free-form vibe input. When the WebLLM engine is ready, EffectVibeChips appends a Mono-styled "もっと" chip that toggles a LCD-style text panel below the chip row. Type any Japanese phrase ("ピヨピヨ", "水族館っぽく", "80年代風"), press Enter or GO, and the on-device LLM interprets it into `{type, wet, param}` and applies it. Falls back to the keyword dictionary when the LLM produces malformed output. Esc closes the panel.
- LCD input has the same display-bg + display-red palette as the BPM display (DESIGN.md §6/§9.6 vocabulary), with a blinking caret prompt and a green "→ TYPE WET% · PARAM%" confirmation when the result lands.
- `<meta name="mobile-web-app-capable">` added alongside the legacy `apple-mobile-web-app-capable` so modern Chromium stops emitting the deprecation warning.

### Fixed
- After a page reload, the AI 提案 toggle was getting pinned at "0%" forever instead of fast-pathing to ON when the model was already cached. Root cause: `useWebLLM`'s effect listed `state.status` in its dependency array, so the first `setState({loading})` triggered a re-render → cleanup set `cancelled = true` → every subsequent progress callback and the final `setState({status:'ready'})` was skipped. Removed `state.status` from the deps and gated unsupported browsers via `detectWebLLMSupport()` inside the effect instead.

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
