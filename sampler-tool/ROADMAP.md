# Hip Hop Sampler — ロードマップ

進捗トラッカー兼次セッション向けのコンテキスト引き継ぎ書。

---

## 📍 現在地 (2026-05-04)

**main の実装状況** (6 PR マージ済み):
- ✅ Tier 1 + Tier 2 (基礎ビートメイキング機能、AUTO CHOP まで)
- ✅ PWA Phase 1 — manifest, SW, install UI (PR #1)
- ✅ PWA Phase 2 — IndexedDB persistence (PR #2)
- ✅ PWA Phase 3 — mobile responsive + touch (PR #3)
- ✅ DESIGN.md (PR #4)
- ✅ ROADMAP sync (PR #5)
- ✅ PWA Phase 4 — lifecycle polish (PR #6)

**PWA 4 フェーズ全完了**。次は P2 拡張機能 or 技術負債解消の選択。

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
- [x] AudioContext resume on visibilitychange (Phase 4)
- [x] AudioGate (suspended 時の tap-to-resume overlay)
- [x] OfflineBadge (navigator.onLine 監視)
- [x] usePersistentStorage + persist トースト
- [x] Tour mobile target fallback (querySelector list 順次試行)

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

最終更新: 2026-05-04 / **PWA 4 フェーズ全完了**

---

## 🎯 次の選択肢

PWA 機能としては完成。ここから先は3方向に分岐:

### A. 機能追加 (P2 拡張機能)
- マイク録音 (getUserMedia でサンプル直接録音) — ペルソナ的に最も "音楽的" な拡張
- エフェクト (リバーブ・ディレイ) — Web Audio Effects、シンプル
- 複数バンク (A/B/C/D で 64 パッド)
- WAV エクスポート (OfflineAudioContext)
- MIDI 入力対応

### B. 技術的負債解消
- ユニットテスト整備 (Vitest, hooks/utils 中心)
- TypeScript 完全移行 (.jsx → .tsx)
- App.jsx 責務分離 (`useChopGroups`, `useAutoChop` フック)
- オーディオレイテンシー実機計測

### C. 実機 QA + リリース
- 実機 (iPhone/Android) で全機能テスト
- /qa スキルで体系的にバグ拾い
- 初リリース (v1.0.0) タグ + CHANGELOG
- デプロイ (Vercel/Netlify/GitHub Pages)

A は楽しい、B は健康に良い、C はユーザーに届ける。
ペルソナ視点 (「DAW挫折者を救う」) では C → A の順がインパクト大。
