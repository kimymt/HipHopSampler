# Hip Hop Sampler

🎛 **Live**: https://sampler.mymt.casa (CF Pages: https://hiphopsampler.pages.dev)

ブラウザベースのサンプリングツールです。インストール不要、PWA としてホーム画面に追加すればオフラインでも動作します。

Teenage Engineering EP-133 / Akai MPC 風の UI で、Web Audio API ベース。スマートフォン (iPhone / Android) でも、デスクトップでも同じ操作感で使えます。

> 🤖 本プロジェクトの開発には [**gstack**](https://github.com/garrytan/gstack) (Claude Code 用の AI コーディング支援ツールキット) を全面的に活用しました。`/qa` (テスト + 自動修正)、`/cso` (セキュリティ監査)、`/review` (PR レビュー)、`/ship` (PR 作成・マージ) などの skill が品質保証と開発スピードに大きく寄与しています。

![Hip Hop Sampler スクリーンショット](https://hiphopsampler.pages.dev/pwa-512.png)

> 本リポジトリのアプリ本体は [`sampler-tool/`](sampler-tool/) サブディレクトリにあります。Cloudflare Pages のビルド設定でこのフォルダを Root directory に指定します (後述)。

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
- ✅ TypeScript 完全移行 + Vitest テスト基盤 (51 tests)
- ✅ オーディオレイテンシ計測

### 検討中 (P2 機能追加)
- [ ] **エフェクト** — リバーブ / ディレイ / ローパスフィルタ (Web Audio Effects)
- [ ] **複数バンク** — A/B/C/D で 64 パッド相当を切替
- [ ] **WAV エクスポート** — `OfflineAudioContext` で全パッド + シーケンサーをミックスダウン
- [ ] **MIDI 入力対応** — Web MIDI API でハードウェアコントローラから演奏
- [ ] **クラウド保存** — 複数デバイス間でパターン同期 (要バックエンド)

詳細は [`sampler-tool/ROADMAP.md`](sampler-tool/ROADMAP.md) を参照してください。

---

## Cloudflare Pages にデプロイする (他人向け手順)

このリポジトリを fork または clone して、自分の Cloudflare アカウントで運用するための手順です。フォークすれば数分で完全に同じものが立ち上がります。

### 必要なもの
- GitHub アカウント
- Cloudflare アカウント (無料で OK)
- (オプション) 独自ドメイン — 持っていればカスタムドメイン設定可能

### 手順

#### 1. このリポジトリを fork
GitHub の `kimymt/HipHopSampler` ページ右上 **Fork** ボタンから自分のアカウントへ複製します。

#### 2. Cloudflare ダッシュボードに入る
1. [dash.cloudflare.com](https://dash.cloudflare.com) → 左メニュー **Workers & Pages**
2. **Create** → **Pages** タブ → **Connect to Git**
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
