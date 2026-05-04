# Hip Hop Sampler

🎛 **本番**: https://sampler.mymt.casa

DAW (Music Production Software) で挫折した未経験者でも、30分でビートが作れるブラウザベースのサンプリングツール。

Teenage Engineering EP-133 / Akai MPC 風のUIで、Web Audio API ベース。インストール不要、PWAとしてホーム画面に追加すればオフラインで動作。

## できること

- 4x4 = 16 パッドにサンプル割り当て (ドラッグ&ドロップ or タップでファイル選択)
- 16ステップシーケンサー (BPM 同期、4小節タブ for モバイル)
- 波形エディタ (IN/OUT トリミング、LOOP プレビュー、SET IN/SET OUT)
- AUTO CHOP — 長尺音源を自動的にトランジェント検出して 16 パッドに分配
- IndexedDB によるサンプル永続化 (リロードで音源が消えない)
- インストール可能PWA (iOS/Android対応)
- モバイル完全対応 (320px〜)

## ドキュメント

| ファイル | 内容 |
|---------|------|
| [DESIGN.md](DESIGN.md) | デザインシステム源泉 (15セクション) |
| [MANUAL.md](MANUAL.md) | 操作マニュアル (日本語) |
| [DEPLOY.md](DEPLOY.md) | Cloudflare Pages デプロイ手順 |
| [ROADMAP.md](ROADMAP.md) | 進捗 + 次のフェーズ |
| [SAMPLER_RESEARCH.md](SAMPLER_RESEARCH.md) | 競合5製品分析 |

## 技術スタック

- **Vite 8** + **React 19** (.jsx + .ts hooks)
- **Web Audio API** で低レイテンシ再生 + シーケンス
- **IndexedDB** でオーディオバッファ永続化
- **vite-plugin-pwa** + workbox precache
- **CSS Custom Properties** ベースのデザイントークン (DESIGN.md §3)

## ローカル開発

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 本番ビルド (dist/)
npm run lint
```

## デプロイ

Cloudflare Pages 経由で main ブランチが自動デプロイ。詳細は [DEPLOY.md](DEPLOY.md)。

## ライセンス

未設定 (MIT 化検討中)
