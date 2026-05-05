# TODO

`/qa` で見つかった deferred 課題、ロードマップから派生した次の検討事項。

---

## 🐛 デプロイ後 QA 残課題 (2026-05-04)

### Cloudflare Insights beacon SRI 不整合 (Medium)
**症状:** ブラウザコンソールに `Failed to find a valid digest in the 'integrity' attribute for resource 'https://static.cloudflareinsights.com/beacon.min.js/...'` のエラー。Web Analytics beacon がブロックされる。

**影響:** 機能に支障なし。Cloudflare Web Analytics がデータを記録できない。

**原因:** Cloudflare が自動注入する beacon タグの SRI ハッシュが、配信される実体ファイルと食い違っている。CF 側の問題でアプリのコードとは無関係。

**選択肢:**
- A) CF Dashboard → `mymt.casa` ゾーン → Speed → Optimization → Web Analytics を OFF (アクセス計測を諦める)
- B) Cloudflare Web Analytics ダッシュボードで Beacon 自動注入の設定をやり直す (CF 側で再発行されると治ることがある)
- C) 別アナリティクス (Plausible / Umami / Self-hosted) を導入

**推奨:** B を試す → ダメなら C で軽量な自前アナリティクスへ。

> 注: PR #12 で CSP ヘッダに CF Insights を allow 済。SRI 問題自体は CF 側の挙動次第。

---

### sw.js が `Cache-Control: max-age=120` で配信される (Low)
**症状:** `_headers` で `/sw.js` を `max-age=0, must-revalidate` 指定したのに、実 response は `max-age=120`。

**影響:** 新バージョン release 後、SW 更新が CDN 上で最大 2分間 stale。`UpdateToast` でユーザーが手動更新できるので致命傷ではない。

**原因:** Cloudflare Pages が JS ファイルに最低 120秒の TTL を強制する仕様らしい (`_headers` で 0 指定しても上書きされる)。

**選択肢:**
- A) Cloudflare Cache Rules で `/sw.js` を Bypass Cache に設定 (Pro plan以上)
- B) 放置 (UpdateToast が user-initiated update を提供している)
- C) sw.js を hashed file 名にする (workbox の precache 戦略を変える)

**推奨:** B。Phase 4 で UpdateToast を実装済みのため、ユーザーが見る最大 stale は 2分以内。

---

## 🎛 エフェクト機能 — Phase 2 / 3 設計判断 TODO

Phase 1 (ネイティブ Web Audio で 5-6 エフェクト) は別 PR で着手。以下は AI エフェクト導入時の判断材料。

> **重要な制約**: 若年層のモバイル利用比率が高いため、**デスクトップ限定の体験は避ける**。iOS Safari / Android Chrome で動くことが前提。

---

### Phase 2: クラウド LLM Function Calling — モデル選定

ユーザーが「もっとローファイに」「水中っぽく」「テープサチュレーション」のように自然言語で指示 → LLM が Web Audio パラメータを JSON で返す → 既存 Phase 1 エフェクトに当てはめる。

#### 候補モデルの比較軸 (調査必要)

| 項目 | Claude (Anthropic) | GPT (OpenAI) | Gemini (Google) |
|---|---|---|---|
| Tool Use / Function Calling 品質 | ? | ? | ? |
| 入力トークン単価 (1Mトークン) | ? | ? | ? |
| 出力トークン単価 | ? | ? | ? |
| レイテンシ p50 (簡単な JSON 生成) | ? | ? | ? |
| 月間無料枠 / 新規アカウント特典 | ? | ? | ? |
| ブラウザ CORS から直接呼べるか | ? | ? | ? |

#### 主要な検討事項
- **どのプランで運用するか** — 個人開発の趣味プロダクトなので、ユーザー数 100-1000 人/月想定でコストが現実的か
- **API key 露出リスク** — ブラウザから直接呼ぶと API key がクライアント露出。Cloudflare Workers (Pages Functions) で proxy する方式か、ユーザーに自分の API key を入れてもらう方式か
- **オフライン時のフォールバック** — PWA でオフライン使用中はこの機能は無効になる旨の UX
- **レイテンシ目標** — 「もっとローファイに」入力 → 音が変わるまで 1.5秒以内が体感的限界。pre-streaming や思考フェーズの可視化が必要か

#### 推奨スパイク
1. 各モデルで「水中っぽくして」を JSON Schema で投げる→ 同じ Web Audio パラメータが返るか比較
2. CF Pages Functions に proxy エンドポイント実装、API key 隠蔽
3. レイテンシ計測を実機で

---

### Phase 3: オンデバイス AI エフェクト — モバイル対応版の調査

> **新しい調査対象**: [Stability AI × Arm: Stable Audio Open Small enabling on-device audio control](https://stability.ai/news-updates/stability-ai-and-arm-release-stable-audio-open-small-enabling-real-world-deployment-for-on-device-audio-control)

#### 注目ポイント
- **497M パラメータ + Int8 量子化** — モバイル端末向けに軽量化
- **Arm KleidiAI 最適化** で Snapdragon / iOS A シリーズの CPU で動作可能を主張
- 12秒オーディオ生成が **モバイル ~7秒** (Arm 公称ベンチ)
- Hugging Face オープンウェイト

#### ブラウザ実装の現実性 (要追加調査)
- **ONNX Runtime Web + WebAssembly + WebGPU/WebNN で iOS Safari 上で動くか**
  - iOS Safari の WebGPU は 2025 後半に limited support。2026 後半~2027 で本格化予想
  - WebNN は iOS Safari 未対応 (2026/5 時点)
  - WASM SIMD のみだと推論が現実的速度で動くか不明
- **モデル DL サイズ** — 数百 MB の初回 DL、PWA cache strategy をどう設計するか
- **代替**: ネイティブ iOS / Android アプリ化を再検討する分岐点になる可能性
- **競合フレームワーク**: TensorFlow Lite Web、Transformers.js (Hugging Face)、MediaPipe で audio 処理可能か

#### 仮説的ユースケース
- 「AI Reimagine」ボタンで pad を選び 1 タップ → モデルがプロンプト内蔵で再解釈 (例: "lo-fi hip hop, vinyl crackle, warm")
- 7秒待ち時間中に進行表示 + 既存サンプルでのプレビュー継続
- 結果を新しいサンプルとして次の空 pad に savepush

#### 推奨スパイク
1. Stable Audio Open Small を Hugging Face から DL → ONNX export → ONNX Runtime Web でデスクトップ Chrome 動作テスト
2. iOS Safari + Android Chrome で同じ ONNX が動くか実機検証
3. 動かない場合は Transformers.js / MediaPipe / TensorFlow Lite Web を順次評価
4. **どれも実用域に達しない場合**: Phase 2 (クラウド LLM) を当面の差別化機能とし、Phase 3 は WebGPU 安定化 (2026 後半~2027) まで延期

---

### 不採用 (理由付き)

- **Apple Intelligence Foundation Model 直接呼出** — 2026/5 時点で audio modality 非対応 + Swift 専用で PWA から呼べない。クラウド LLM Function Calling が同等体験を全プラットフォームで提供できるため、Apple 縛りに乗る理由がない
- **デスクトップ限定の Stable Audio Open Small** — 若年層モバイル利用比率を考えると体験が限定される。モバイルでも動くまで延期

---

## 🟢 P2 — 機能追加 (ROADMAP)

優先順位順:

- [x] ~~**マイク録音**~~ (PR #9 で完了)
- [ ] **エフェクト** (Phase 1: Reverb / Delay / Filter / Saturation / Lo-fi など Web Audio ネイティブ) — 着手中
- [ ] **エフェクト** (Phase 2: LLM Function Calling, 上記 TODO 参照)
- [ ] **エフェクト** (Phase 3: オンデバイス生成 AI, 上記 TODO 参照)
- [ ] **複数バンク** (A/B/C/D で 64 パッド)
- [ ] **WAV エクスポート** (OfflineAudioContext)
- [ ] **MIDI 入力対応** (Web MIDI API)
- [ ] **クラウド保存** (要バックエンド)

---

## 🔧 技術的負債 (ROADMAP)

- [x] ~~**オーディオレイテンシー測定**~~ (PR #19 で完了 — Settings に LatencyBadge)
- [x] ~~**TypeScript 完全移行**~~ (PR #18 で完了 — 21 files、57→0 type errors)
- [x] ~~**ユニットテスト**~~ (PR #17 で完了 — Vitest + 51 tests)
- [x] ~~**App.jsx の責務分離**~~ (PR #13 で完了 — useAutoChop / useChopGroups 抽出)
- [x] ~~**App.jsx の `selectedSample` 参照順序**~~ (PR #13 で完了)
- [x] ~~**Tour spotlight モバイル時挙動**~~ (PR #12 で完了 — auto-rotate + 明度向上)

技術的負債タスクはすべて解消済 (2026-05-05)。

---

## 📂 セッション間で参照すべきファイル

新セッション開始時に読むべき順:

1. **このファイル** (`sampler-tool/TODO.md`) — 今すぐの懸案
2. **`sampler-tool/ROADMAP.md`** — 全体ロードマップ + Phase 完了履歴
3. **`sampler-tool/DESIGN.md`** — デザインの判断基準 (518行)
4. **`sampler-tool/DEPLOY.md`** — デプロイ手順、本番URL
5. **`~/.claude/projects/-Users-likemike-Documents-gstack/memory/sampler_persona.md`** — ペルソナ (DAW挫折者)
6. **GitHub:** https://github.com/kimymt/HipHopSampler — リポジトリ

---

最終更新: 2026-05-05 / 技術的負債 4 PR 全完了、リポ整理完了 / エフェクト Phase 1 着手
