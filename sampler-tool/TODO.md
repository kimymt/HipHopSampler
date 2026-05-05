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

### Phase 2: クラウド LLM Function Calling — 調査完了 (2026-05-05)

ユーザーが「もっとローファイに」「水中っぽく」「テープサチュレーション」のように自然言語で指示 → LLM が Web Audio パラメータを JSON で返す → 既存 Phase 1 エフェクトに当てはめる。

#### 想定 JSON 出力スキーマ
```json
{
  "type": "filter" | "reverb" | "delay" | "saturation" | "lofi",
  "wet": 0.0-1.0,
  "param": 0.0-1.0,
  "explanation": "string (なぜそのエフェクトを選んだか)"
}
```
入力 system+user ~700tok / 出力 ~80tok。月 50,000 req (1000人 × 50回) 想定。

#### モデル比較表 (2026-05 時点の公開情報)

| モデル | TTFT p50 | 月50k req コスト | 月間無料枠 | 評価 |
|---|---|---|---|---|
| **Gemini 2.5 Flash** ⭐推奨 | **0.54s** | **$20.5** | 250 RPD | レイテンシ最速、開発期実質無料 |
| GPT-5 nano | 0.96s | $3.4 | 限定 (Tier 0) | 最安だが TTFT 遅め |
| Claude Haiku 4.5 | 0.71s | $55 | $5 トライアルのみ | 日本語の音楽ドメイン語彙最強 |
| GPT-5 mini | ~1.0s | $16.8 | なし | 中庸 |
| Sonnet/GPT-5.4/Pro | 1.5-2.5s | $150+ | — | 個人運用は厳しい |

3社とも CORS で直接ブラウザ呼出は可能だが、API key 露出リスクのため **proxy 必須**。

#### アーキテクチャ判断 (確定)

**選定: Gemini 2.5 Flash + Cloudflare Pages Functions proxy**

理由:
1. TTFT 0.54s で「水中っぽくして」入力 → 反映 1秒切る体感
2. 既存 CF Pages ホスティングに `functions/api/effect.ts` 追加するだけ
3. Workers Free Plan が 100k req/日まで無料 → 月 $0 運用可
4. 250 RPD の Gemini 無料枠で開発・低トラフィック期は実質無料
5. function calling 成熟、5択カテゴリ + float 2つの小スキーマには十二分
6. 月 $20.5 は持続可能ライン

**セカンド: Claude Haiku 4.5** — 日本語の音楽ドメイン語彙 (「ローファイ」「ソウルフル」「アシッド」) 理解が3社で頭一つ抜けている。MVP リリース後にユーザーフィードバックで JSON 妥当性に不満が出れば切替候補。

**不採用: BYO API key 方式** — DAW 挫折者ペルソナに Console 登録 → Billing → Key 発行は無理。利用率が 1-5% に激減する。

#### 実装スパイク (Phase 2 作業項目)

1. `sampler-tool/functions/api/effect.ts` Pages Function を作成
   - Gemini 2.5 Flash API を呼び出す proxy
   - origin チェック (本番ドメインからのみ受付)
   - IP 単位 rate limit (10 req/min)
   - ユーザー月 100 回上限 (CF KV で counter)
   - API key は CF Pages 環境変数で隠蔽
2. EffectPanel に自然言語入力欄を追加
   - テキスト入力 + 送信ボタン
   - 思考中の状態表示 (Loading dots, ~1秒以内に消える想定)
   - 戻ってきた JSON を `setFx({ type, wet, param })` で当てる
3. **オフライン UX + LLM 障害時 fallback**:
   - ネット切断時はテキスト入力 disable + ツールチップ「オフラインのため AI 提案は利用できません」
   - **キーワードプリセットボタン**を常設: `UNDERWATER` / `LO-FI` / `SPACEY` / `WARM` / `CRUSHED` → 固定 JSON マッピング
   - LLM 失敗時もこちらでサービス継続
4. 計測: 実機で TTFT 計測、95th percentile を Settings の LatencyBadge 横に表示するか検討

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
