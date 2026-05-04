# Deploy — Cloudflare Pages

| | |
|---|---|
| **本番URL** | https://sampler.mymt.casa |
| **CF Pages URL** | https://hip-hop-sampler.pages.dev |
| **ホスティング** | Cloudflare Pages |
| **DNS** | Cloudflare (mymt.casa) |

---

## なぜ Cloudflare Pages

- **DNS と同じダッシュボード** で完結 (CNAME 設定が「Add custom domain」ボタン1つ)
- 帯域 **無制限・無料**
- Cloudflare の前段に別 CDN を置くと SW キャッシュ問題が起きうるが、Pages なら同社内で完結 → ハマりポイントなし
- PR ごとに **preview URL** が自動 (`feature-x.hip-hop-sampler.pages.dev` 形式)
- ビルド分 500分/月 (1ビルド30秒なので余裕)

---

## 初回セットアップ (一度だけ)

### 1. Cloudflare ダッシュボード

1. https://dash.cloudflare.com → **Workers & Pages** → **Create**
2. **Pages** タブ → **Connect to Git**
3. GitHub アカウント `kimymt` を認可
4. リポジトリ `kimymt/HipHopSampler` を選択 → **Begin setup**

### 2. ビルド設定

| 項目 | 値 |
|------|---|
| Project name | `hip-hop-sampler` |
| Production branch | `main` |
| Framework preset | `Vite` |
| **Root directory** | **`sampler-tool`** ← 重要 (リポジトリのサブフォルダ) |
| Build command | `npm install && npm run build` |
| Build output directory | `dist` |

**Save and Deploy** をクリック。初回ビルド ~1分。

### 3. デプロイ完了確認

- `https://hip-hop-sampler.pages.dev` にアクセス → アプリが起動
- DevTools → Application → Service Workers で SW がアクティブ
- DevTools → Application → Manifest で manifest が読み込まれている

### 4. カスタムドメイン (`sampler.mymt.casa`)

1. Pages プロジェクト `hip-hop-sampler` → **Custom domains** タブ → **Set up a custom domain**
2. `sampler.mymt.casa` を入力 → **Continue**
3. Cloudflare が `mymt.casa` ゾーン内に CNAME を自動追加 → 確認画面 → **Activate domain**
4. SSL 証明書発行を待つ (~30秒〜2分)
5. 完了後、`https://sampler.mymt.casa` でアクセス可能。`hip-hop-sampler.pages.dev` も併存

> `mymt.casa` が既に Cloudflare DNS に乗っているため、外部 DNS の手作業は一切不要。Pages がレコードを自動追加 (CNAME `sampler` → `hip-hop-sampler.pages.dev`)。

---

## 通常の更新フロー

### main にマージ → 本番デプロイ

`/ship` または手動マージで PR を main にマージすると、Cloudflare Pages が自動的に本番ビルド + デプロイ (1分以内)。

### 機能ブランチ → preview URL

```
git checkout -b feature/effects-reverb
# 作業
git push -u origin feature/effects-reverb
gh pr create
```

PR 作成と同時に Cloudflare が `feature-effects-reverb.hip-hop-sampler.pages.dev` を自動生成。実機モバイルで触りたい時もこの URL から。

---

## 設定ファイル

リポジトリに含まれる Pages 関連ファイル:

| ファイル | 役割 |
|---------|------|
| `sampler-tool/public/_headers` | キャッシュ + セキュリティヘッダー (PWA SW を no-cache にするのが重要) |
| `sampler-tool/public/_redirects` | SPA fallback (将来 routes 追加時の保険) |
| `sampler-tool/vite.config.js` | Vite + vite-plugin-pwa の生成設定 |

ビルド時、`public/` の中身は `dist/` ルートに丸ごとコピーされる。Cloudflare Pages はデプロイ時に `_headers` と `_redirects` を自動認識する。

---

## トラブルシューティング

### SW が更新されない
`_headers` で `/sw.js` を no-cache にしているため通常は問題ない。それでも更新されない時:
- ブラウザの Application → Service Workers → Unregister → ハードリロード
- ユーザー側は UpdateToast の「更新」ボタンで対応 (Phase 1 機能)

### 「Mixed content」エラー
HTTP の絶対 URL がコード内に残っていないか確認。本プロジェクトは全て相対パス + HTTPS なので問題ないはずだが、外部 API を後で追加する時は要注意。

### ビルド失敗
- Root directory 設定を `sampler-tool` にしているか確認
- node 20+ で動作確認 (Cloudflare Pages のデフォルトは node 22 なので大丈夫)

### iOS インストール時に動かない
- 必ず HTTPS でアクセスしているか (Pages はデフォルト HTTPS)
- manifest が読み込まれているか (DevTools)
- アイコンが 192/512px 揃っているか (`public/pwa-*.png`)

---

## 監視

- **Cloudflare Analytics** (Pages プロジェクト → Analytics) でページビュー、帯域、Core Web Vitals が無料で見える
- エラーログは Cloudflare Web Analytics か、必要に応じて Sentry を後で追加
