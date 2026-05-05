# Hip Hop Sampler

🎛 **Live**: https://sampler.mymt.casa

ブラウザベースのサンプリングツールです。インストール不要、PWA としてホーム画面に追加すればオフラインでも動作します。

Teenage Engineering EP-133 / Akai MPC 風の UI で、Web Audio API ベース。スマートフォン (iPhone / Android) でも、デスクトップでも同じ操作感で使えます。

> 🤖 本プロジェクトの開発には [**gstack**](https://github.com/garrytan/gstack) (Claude Code 用の AI コーディング支援ツールキット) を全面的に活用しました。

![Hip Hop Sampler スクリーンショット](https://hiphopsampler.pages.dev/pwa-512.png)

---

## できること

### サンプル投入の3手段
- 🎙 **マイク録音** — 空パッド左下のボタンをタップして、声・手拍子・楽器など何でも10秒まで録音 (iOS / Android Safari 対応)
- ➕ **ファイル選択** — 空パッド右下の "+" から WAV / MP3 を選択
- 🖱 **ドラッグ&ドロップ** — デスクトップではパッドを選択 → ファイルをウィンドウに drop

### サンプル編集
- **波形エディタ** — IN / OUT マーカーをドラッグしてトリミング
- **LOOP 再生** — 編集中に SET IN / SET OUT を耳で確認
- **Volume / Pan** — ステレオパンナーで定位調整
- **AUTO CHOP** — 長尺音源を自動的にトランジェント検出して 16 パッドに分配 (チョップ後も境界線を手動微調整可能)

### シーケンサー
- 16ステップ × 4小節
- BPM 60-200 (Hip Hop 定番は 85-95)
- **ライブ録音** — Record + Play 同時押しで、叩いた瞬間がパターンに記録される
- パッドは `1234 / QWER / ASDF / ZXCV` のキーボードショートカットでも演奏可能

### マスター FX
全パッドの出力に1つだけかけられるグローバルエフェクト。SP-404 / EP-133 流の "1スロット + ワンノブ" 設計で、DAW 経験がなくても触りやすい構成にしています。

- 🌌 **Reverb** — 部屋の広がり (狭い → ホール)
- 🔁 **Delay** — BPM 同期のやまびこ (1/16・1/8・1/8.・1/4・1/4. の 5 段階)
- 🎚 **Filter** — Low-pass ↔ High-pass 切替 (モコモコ → ハッキリ)
- 🔥 **Saturation** — アナログ風の温かい歪み (薄い → 濃い)
- 📼 **Lo-fi** — カセットテープ風の劣化 (BitCrusher AudioWorklet)
- **WET / PARAM の 2 ノブ** + **BYPASS** で原音と切り替え比較
- 設定は localStorage に自動保存、リロード後も復元

### PWA (Progressive Web App)
- ホーム画面に追加でスタンドアロン起動
- オフライン動作 (Service Worker precache)
- IndexedDB でサンプル + パターンを永続化 (リロードしても残る)
- iOS Safari / Android Chrome / デスクトップ Chrome / Firefox 対応

---

## ロードマップ

### 完了済 (リリース済)
- ✅ Tier 1+2 ビートメイキング基礎機能
- ✅ PWA Phase 1-4 (manifest / SW / IndexedDB / mobile / lifecycle)
- ✅ AUTO CHOP (onset detection)
- ✅ マイク録音 + 録音 UI
- ✅ TypeScript 完全移行 + Vitest テスト基盤 (75 tests)
- ✅ オーディオレイテンシ計測
- ✅ **マスター FX Phase 1** — Reverb / Delay / Filter / Saturation / Lo-fi

### 検討中 (P2 機能追加)
- [ ] **AI エフェクト指示 (Phase 2A)** — 「もっとローファイに」「水中っぽく」と入力して FX を自動設定 (キーワード辞書方式、全プラットフォーム動作・$0)
- [ ] **AI エフェクト指示 (Phase 2B)** — WebLLM (Qwen 2.5 0.5B) でブラウザ内ローカル LLM、より柔軟な自然言語入力 (Chrome / Android、要 WebGPU)
- [ ] **複数バンク** — A/B/C/D で 64 パッド相当を切替
- [ ] **WAV エクスポート** — `OfflineAudioContext` で全パッド + シーケンサーをミックスダウン
- [ ] **MIDI 入力対応** — Web MIDI API でハードウェアコントローラから演奏
- [ ] **クラウド保存** — 複数デバイス間でパターン同期 (要バックエンド)

### 将来 (要技術成熟待ち)
- [ ] **AI 音声直接変換 (Phase 3)** — Stable Audio Open Small 等のオンデバイス音声生成 AI で「水中っぽくして」をサンプル音そのものに適用。2027 頃 (transformers.js の audio diffusion 対応 + iOS Safari WebGPU 完全展開を待ち)

詳細は [`sampler-tool/ROADMAP.md`](sampler-tool/ROADMAP.md) を参照してください。

---

## 自分のCloudflare Pagesで使えるようにするには

このリポジトリを fork または clone して、自分の Cloudflare アカウントで運用するための手順です。フォークすれば数分で完全に同じものが立ち上がります。
> 本リポジトリのアプリ本体は [`sampler-tool/`](sampler-tool/) サブディレクトリにあります。Cloudflare Pages のビルド設定でこのフォルダを Root directory に指定します (後述)。

### 必要なもの
- GitHub アカウント
- Cloudflare アカウント (無料で OK)

### 手順

#### 1. このリポジトリを fork
GitHub の `kimymt/HipHopSampler` ページ右上 **Fork** ボタンから自分のアカウントへ複製します。

#### 2. Cloudflare ダッシュボードに入る
1. [dash.cloudflare.com](https://dash.cloudflare.com) → 左メニュー **Workers & Pages**
2. **Create application** → Looking to deploy Pages? **Get started** → Import an existing Git repository **Get started**
3. 自分の GitHub アカウントを認可し、fork した `HipHopSampler` リポジトリを選択
4. **Begin setup** をクリック

#### 3. ビルド設定 (重要)

| 項目 | 値 |
|------|---|
| Project name | 任意 (例: `my-hh-sampler`) |
| Production branch | `main` |
| **Framework preset** | **`None`** |
| **Root directory** | **`sampler-tool`** ← 必須 |
| Build command | `npm install && npm run build` |
| Build output directory | `dist` |

> ⚠ Cloudflare の preset 一覧に「Vite」は無いので **None** を選び、Build command と Output directory を手動で入力します。

#### 4. デプロイ
**Save and Deploy** をクリック。初回ビルドはおよそ1分で完了し、`https://<project-name>.pages.dev` にアクセスできるようになります。

---

## ライセンス

[MIT License](LICENSE)
