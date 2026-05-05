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

### Phase 2: 自然言語 → エフェクト指示 — 方針決定 (2026-05-05)

ユーザーが「もっとローファイに」「水中っぽく」「テープサチュレーション」のように自然言語で指示 → 既存 Phase 1 エフェクトに当てはめる。

**個人プロジェクトのため固定費・従量課金は完全に避け、オンデバイス/無料運用を最優先**。

#### 採用アーキテクチャ: ハイブリッド3段構成

| 段階 | 方式 | 対応プラットフォーム | コスト | 着手優先度 |
|---|---|---|---|---|
| **Phase 2A** | キーワード辞書 + 直接 JSON マッピング | 全 (iOS/Android/Desktop) | $0 | ⭐ 即実装 |
| **Phase 2B** | WebLLM (Qwen 2.5 0.5B) オンデバイス | Chrome / Android (WebGPU) | $0 | 中期 |
| **Phase 2C** | クラウド LLM (Gemini Flash) BYO key | 全 | ユーザー負担 | 任意 |

クラウドサーバー側 proxy 運営は**廃案**。Gemini Flash 採用するなら BYO key 形式に限定 (運営費 0)。

#### 想定 JSON 出力スキーマ (どの段でも共通)
```json
{
  "type": "filter" | "reverb" | "delay" | "saturation" | "lofi",
  "wet": 0.0-1.0,
  "param": 0.0-1.0,
  "explanation": "string (なぜそのエフェクトを選んだか)"
}
```

---

#### Phase 2A: キーワード辞書方式 (即実装、最優先)

完全オフライン、0 latency、全プラットフォーム動作。AI なしでも 80% のユースケースを賄える MVP。

**UI 方針 (2026-05-05 `/design-consultation` で確定 → DESIGN.md §9.15):**

- **chip-first**。テキスト入力欄は Phase 2A では **作らない**。
- EffectPanel 上部に `EffectVibeChips` (横スクロール chip 列) を新設、辞書 30 件のうち**人気 8〜12 件のみ chip として表示**。
- chip タップで `{type, wet, param}` を即適用、type ボタン + WET/PARAM ノブが自動同期 (250ms アニメで学習効果)。
- 残り 18 件はテキスト入力 + マッチ候補提示が必要なので **Phase 2B (LLM) で初出**。それまでは辞書に存在するが UI 露出ナシ。
- 末尾「他の言葉」chip + LCD 風 text input は Phase 2B 投入時のみ追加 (Phase 2A 期間中は DOM にも出さない)。
- 詳細仕様 (chip サイズ/状態/排版例外/動作) は DESIGN.md §9.15 を単一参照点とする。

**実装内容:**
- `src/effects/presetDictionary.ts`: 日本語キーワード 30 件 → `{type, wet, param}` マッピング。
  - 人気 chip 12 件 (例: `水中` `ローファイ` `広い` `狭い` `歪み` `テープ` `クリア` `電話` `ヴィンテージ` `アシッド` `深い` `軽い`) を `chipKeywords` array に分離。
  - 残り 18 件は同じファイルだが `extendedKeywords` として export、Phase 2B 用。
- `src/components/EffectVibeChips.tsx` + `.css`: DESIGN.md §9.15 通り。日本語 Sans 13px、Mono は「他の言葉」chip だけ。
- `EffectPanel.tsx` 統合: chip 列を `effect-type-row` の上に挿入。chip タップ → `onFxChange` 経路で既存ロジック流用。

**メリット:**
- コスト 0 / 永久無料
- レイテンシ < 10ms
- iOS Safari でも完全動作
- text input ナシで blank-page anxiety を回避 (persona D 判定)
- 辞書本体は Phase 2B/2C 導入後も基盤として残す (LLM 障害時 fallback)

**デメリット:**
- chip にない表現 (例:「ピヨピヨして」「水族館っぽく」) は Phase 2A では到達不可 → Phase 2B/2C で補完
- 12 件の chip 選定が文化判断 (DAW 用語ではなく一般語をどう選ぶか) に依存

---

#### Phase 2B: WebLLM オンデバイス LLM (中期)

Chrome / Android Chrome で WebGPU 経由ローカル推論。完全無料 + プライバシー保護 + オフライン後でも動作。

**選定モデル候補:**

| モデル | サイズ | 速度 | 評価 |
|---|---|---|---|
| **Qwen 2.5 0.5B INT4** | ~300MB | 40-180 tok/s | ⭐ 推奨 (バランス) |
| Qwen 3.5 0.8B INT4 | ~500MB | 90-180 tok/s | 性能上 (要 DL 待ち) |
| Phi-3.5 Mini 3.8B INT4 | ~2GB | 20-60 tok/s | 高品質だが DL 重い |
| Gemma 3 2B INT4 | ~1GB | 30-90 tok/s | Google 製 |

**プラットフォーム対応 (2026-05):**

| 環境 | WebGPU 状況 | 動作可否 |
|---|---|---|
| Desktop Chrome / Edge | デフォルト ON | ◎ |
| Android Chrome | デフォルト ON | ◎ |
| **iOS Safari** | **Safari 26 beta のみ** | △ (要 beta OS、real-world 普及は 2027 想定) |
| Firefox | デフォルト ON | ○ |

**実装方針:**
- オプトインボタン「🤖 高度な AI 提案を有効化 (300MB)」を Settings に配置
- 初回 DL → Service Worker / Cache API で永続化、2回目以降は即起動
- WebGPU 未対応端末は自動で Phase 2A にフォールバック
- Function calling / Structured Output で JSON 出力を強制

**メリット:**
- 完全無料、無制限、プライバシー保護
- オフライン後も動く
- ユーザー所有体験 ("自分のブラウザで AI が動いてる")

**デメリット:**
- iOS Safari で動かない (2026-05 時点)
- 初回 300MB DL のハードル
- 推論レイテンシ ~1-2秒 (キーワードよりは遅い)

---

#### Phase 2C: クラウド LLM (BYO key 限定オプション、任意)

「もっと柔軟な AI を使いたい上級者」向けに、ユーザー自身の API key を入れる形でオプトイン提供。**運営側でクラウド proxy は立てない (固定費 0 ポリシー)**。

**選定:** Gemini 2.5 Flash (TTFT 0.54s、無料枠 250 RPD)

**実装方針:**
- Settings に「Google Gemini API key を入力」フィールド (localStorage 保存、暗号化 optional)
- API key 入力済みのときのみ「クラウド AI で考える (高品質)」ボタンが有効化
- 直接ブラウザから Gemini API へリクエスト (CORS 対応済)
- 失敗時は Phase 2A にフォールバック

**注意:** DAW 挫折者ペルソナには登録障壁が高い → デフォルトで隠す。「設定 > 上級者向け」配下に置く。利用率は数%想定。

---

#### Phase 3: 直接音声変換 (Stable Audio Open Small) — 延期

**結論: 2026-05 時点でブラウザ実装は実用域外**。

調査結果:
- Stability AI 公式 demo はブラウザ用ではない (HuggingFace Spaces 経由のサーバーサイド)
- transformers.js / community implementation で **Stable Audio Open Small をブラウザ動作させた事例なし**
- Arm KleidiAI 最適化はネイティブ ARM 向け、ブラウザでは恩恵なし
- audio diffusion model 自体が transformers.js でまだ十分サポートされていない

**再検討時期:** 2027 (transformers.js が audio diffusion model 対応 + iOS Safari WebGPU が完全展開した後)

代替の中期案:
- **CLAP (Contrastive Language-Audio Pretraining)** で「ぽい雰囲気」をプリセット最近傍検索 — Phase 2A 拡張として検討余地あり

---

#### 実装ロードマップ (Phase 2)

1. **Phase 2A (1週間)**: 辞書 30件 + `EffectVibeChips` (chip 8-12件 horizontal scroll) + EffectPanel 統合。text input ナシ。DESIGN.md §9.15 仕様に沿う
2. **Phase 2B (2週間、Phase 2A 完了後)**: 「他の言葉」chip + LCD 風 text input + WebLLM 統合 (Qwen 2.5 0.5B)、辞書残り 18件含む拡張カバレッジ、マッチ失敗時候補提示
3. **Phase 2C (任意、半日)**: BYO key 入力欄 + Gemini Flash 直接呼出 (Settings 配下に隠す)
4. **Phase 3**: 2027 まで再評価しない (TODO に再調査リマインダーのみ残す)

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

最終更新: 2026-05-05 / Phase 2A を chip-first に reframe (`/design-consultation` 結果) / DESIGN.md §9.15 EffectVibeChips 追加
