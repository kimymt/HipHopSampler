# Hip Hop Sampler — ロードマップ

進捗トラッカー兼次セッション向けのコンテキスト引き継ぎ書。

---

## 📍 現在地 (2026-05-04)

**main の実装状況** (4 PR マージ済み):
- ✅ Tier 1 + Tier 2 (基礎ビートメイキング機能、AUTO CHOP まで)
- ✅ PWA Phase 1 — manifest, SW, install UI (PR #1)
- ✅ PWA Phase 2 — IndexedDB persistence (PR #2)
- ✅ PWA Phase 3 — mobile responsive + touch (PR #3)
- ✅ DESIGN.md (PR #4)

**次のセッションで着手:** PWA Phase 4 (polish)

---

## 🎯 PWA Phase 4 — Polish (次セッション)

スコープ小さめ、1日想定。

- [ ] **AudioContext resume on visibilitychange** — バックグラウンドから戻った時に context が suspended なら resume。iOS Safari の audio bug 対策の基本中の基本
- [ ] **Persistent Storage explicit request UX** — 初回サンプルロード時に `navigator.storage.persist()` を呼び、結果 (granted / denied) を user に通知 (toast or settings sheet)
- [ ] **オフライン状態表示** — `navigator.onLine` 監視。オフライン時は TransportBar に小さな「OFFLINE」インジケータ
- [ ] **AudioContext suspended UX** — autoplay policy で初回 suspended な時、画面に「タップで起動」オーバーレイ
- [ ] **(オプション) Tour spotlight モバイル動作の検証/修正** — Phase 3 では既存ロジックそのまま乗せた。実機で挙動を確認

実装ブランチ: `feature/pwa-phase4-polish`

---

## ✅ 完了済み (履歴)

### P0 — 初心者UX致命傷
- [x] パッド数を4x4=16に変更 — MPC標準
- [x] キーボードキー表示 — 各パッド右上に英字
- [x] 空パッドの「DROP」案内
- [x] ステータス表示 — PADS x/16, IDLE/PLAYING LED
- [x] トランスポートバー — BPM, Play/Stop, Record
- [x] ビジュアルの「Hip Hop感」 — TE EP-133 風 cream + orange (CSS変数化済)

### P1 — ビートメイキング基本機能
- [x] 16ステップシーケンサー — beat highlight + current cursor
- [x] ミキサーパネル — Volume / Pan (StereoPannerNode)
- [x] 波形トリミング — IN/OUT 黄色マーカー drag + LOOP PLAY + SET IN/OUT
- [x] ループ設定 — Web Audio loop + watcher で IN/OUT live update
- [x] パターン保存・復元 — localStorage (BPM/patterns) + IndexedDB (audio)
- [x] AUTO CHOP — onset detection + 折衷案 (即時 + ライブドラッグ)

### PWA
- [x] vite-plugin-pwa + manifest + SW (Phase 1)
- [x] Custom branded icons (TE オレンジ + 4x4 pad SVG)
- [x] InstallButton + IosInstallGuide + UpdateToast
- [x] IndexedDB 永続化 (audio + pads dual-store, source dedupe) (Phase 2)
- [x] StartupLoader (progress + escape hatch) + StorageBadge
- [x] Mobile responsive (320 / 768 / 1024 ブレイクポイント) (Phase 3)
- [x] Pointer events (mouse + touch + stylus 統一)
- [x] BPM `inputmode="numeric"`
- [x] BottomSheet (sample panel) + SettingsSheet (補助機能)
- [x] Pad "+" file picker fallback (iOS HTML5 D&D 不可対応)

### Documentation
- [x] SAMPLER_RESEARCH.md — 競合5製品分析
- [x] MANUAL.md — 操作マニュアル (日本語)
- [x] DESIGN.md — デザインシステム源泉 (15セクション 519行)
- [x] Onboarding tour — 13 ステップ (Tour.jsx)
- [x] ペルソナ — `~/.claude/projects/.../memory/sampler_persona.md`

---

## 🟢 P2 — 拡張機能 (Phase 4 後)

- [ ] **AudioBuffer dedup for chop groups** (現状: chop 時は sourceId 共有して dedupe 済 ✅)
- [ ] **エフェクト** — リバーブ、ディレイ、ローパスフィルタ (Web Audio Effects)
- [ ] **ピッチシフト/タイムストレッチ** (重い)
- [ ] **MIDI入力対応** — Web MIDI API
- [ ] **複数バンク** — A/B/C/D で64パッド相当を切替
- [ ] **エクスポート** — WAV/MP3 ミックスダウン (OfflineAudioContext)
- [ ] **クラウド保存** — 複数デバイス間同期 (要バックエンド)
- [ ] **マイク録音** — getUserMedia でサンプル直接録音

---

## 🔧 技術的負債・最適化

- [ ] **オーディオレイテンシー測定** — 100ms以内達成の検証 (実機 + Audio Worklet 計測)
- [ ] **AudioBufferのキャッシュ管理** — メモリリーク防止 (現状: 削除時に GC、十分な可能性)
- [ ] **TypeScript完全移行** — 現状 .jsx と .ts 混在。`.jsx` → `.tsx` 化 + 型付け
- [ ] **ユニットテスト** — Vitest で hooks (useSequencer, useAudioEngine) と utils (onsetDetect) を保護
- [ ] **App.jsx の責務分離** — 230行に肥大化。`useChopGroups`, `useAutoChop` フックに切り出し
- [ ] **Tour spotlight モバイル時挙動** — PR #3 では未検証 (実機でテスト要)

---

## 📂 セッション間で参照すべきファイル

新セッション開始時、必ず以下を確認 (`/context-restore` 相当):

| ファイル | 用途 |
|---------|------|
| `sampler-tool/DESIGN.md` | デザインの判断基準 |
| `sampler-tool/ROADMAP.md` | このファイル — 進捗 + 次タスク |
| `sampler-tool/MANUAL.md` | ユーザー向け操作マニュアル |
| `~/.claude/projects/-Users-likemike-Documents-gstack/memory/sampler_persona.md` | ペルソナ (DAW挫折者) |
| `~/.gstack/projects/cool-proskuriakova-258e51/ceo-plans/pwa-phase3-mobile.md` | Phase 3 計画書 (参考) |
| `~/.gstack/projects/cool-proskuriakova-258e51/designs/phase3-mobile-20260504/mockups.html` | Phase 3 承認モックアップ |
| GitHub: https://github.com/kimymt/HipHopSampler | リポジトリ + マージ済 PR 履歴 |

---

最終更新: 2026-05-04 / Phase 3 + DESIGN.md マージ後 / Phase 4 開始前
