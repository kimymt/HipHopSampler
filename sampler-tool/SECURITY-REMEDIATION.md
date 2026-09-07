# セキュリティ修正結果

確認日: 2026-09-07。対象はローカルの作業ツリー。本番へのデプロイは未実施。
監査で確認した6件（高0・中3・低3）に以下の修正を実装した。

| 危険度 | 懸念 | 修正 |
| --- | --- | --- |
| 中 | マイクの連続開始・停止後の遅延応答で録音が残る | 開始要求を同期的に予約し、録音セッションを分離。停止・アンマウント後に取得したトラックも停止する。 |
| 中 | 失敗・差し替え・削除時の音声残留 | デコード成功後に音声とパッドを同一IndexedDBトランザクションで保存し、未参照音声を回収。削除失敗時はUIと参照を保持して再試行可能にする。起動時に既存の孤立音声も回収する。 |
| 中 | 音声デコード・復元のメモリ制限不足 | デコード前にコンテナーの時間・チャンネル・サンプルレートを検査。インポート・復元・参考曲のデコードを直列化し、保持中・再生中のPCMを集計する。 |
| 低 | 開発依存の既知の脆弱性 | Vite、PWA/Workbox、sharp等を更新し、npmのロックファイルを更新。 |
| 低 | CSPのインラインJavaScript許可 | script-srcからunsafe-inlineを除去。WebLLM用wasm-unsafe-evalは維持。 |
| 低 | 外部AI成果物の可変URL・検証不足 | モデルとWASMをコミット固定。config・WASM・tokenizerのSHA-256検証を有効化し、不一致時はエラーにする。SDKも0.2.83に固定。 |

## 音声の制限と既存データ

- ファイルは32MiB以下、5分以内、1〜2チャンネル、8〜96kHz。
- デコード後PCMは1音声64MiB、保持合計192MiBを上限とする。コーデックのパディングに1秒分の余裕を予約する。
- この予算は音声PCMの管理値であり、ブラウザー全体のメモリ消費を保証するものではない。
- 復元できない既存音声は自動削除しない。正常なパッドを復元し、失敗したパッドを表示して差し替え・削除できる。
- WAV、MP3、Ogg（FLAC/Vorbis/Opus）、M4A、FLAC、WebM、AACを実ブラウザーで確認した。対応可否はブラウザーのデコーダーにも依存する。

## 検証結果

- `npm test`: 17ファイル、161件成功。
- `npm run typecheck`、`npm run lint`、`npm run build`: 成功。lintの既存対象はJS/JSX、TSは型チェックで検証。
- `npm audit`および`npm audit --omit=dev`: 既知の脆弱性0件。更新前は開発依存14件、本番依存0件。
- マイク競合と保存失敗の回帰テストは、修正前コードで失敗することを確認した。
- Chromium、本番ビルドと_headersのCSPを配信するローカルサーバーで確認:
  - 正常な9ファイルを保存し、破損WAV・33MiB・301秒の入力は保存前に拒否。音声9件・パッド9件・孤立音声0件。
  - 差し替え後も音声9件・パッド9件・孤立音声0件。UIから削除後は各8件・孤立音声0件。
  - 再読み込みで残した8音声を復元し、削除済みパッドは空のまま。
  - インラインスクリプトはscript-src-elem違反で遮断され、実行されない。Service Workerの制御を確認。
- AI成果物の実バイトからハッシュを算出し、SDKの検証関数が改変バイトを拒否することをテストした。

実機マイクとWebGPUでのモデル全体の推論は未検証。モデル重みはコミット固定だが、SDKには重みシャードごとのSRI指定がない。Cloudflare本番でのヘッダー反映・付加スクリプトとの互換性はデプロイ後の確認が必要。ビルド時のWebLLMのurl外部化・大きな遅延読み込みチャンクの警告は残っている。

## 確認した仕様・アドバイザリー

以下は監査・修正中にHTTP 200を確認した参照先。

- [MediaStreamTrack.stop](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/stop)
- [CSP script-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src)
- [Vite advisory](https://github.com/advisories/GHSA-fx2h-pf6j-xcff)
- [WebLLM configuration](https://github.com/mlc-ai/web-llm/blob/main/src/config.ts)
- [Ogg FLAC mapping](https://xiph.org/flac/ogg_mapping.html)
