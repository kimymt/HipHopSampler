# TODO

`/qa` で見つかった deferred 課題と、Phase 4 後に積んだ Phase 2 候補のうち本セッションでは見送ったもの。

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

## 🟢 P2 — 機能追加 (ROADMAP からのコピー)

優先順位順:

- [ ] **マイク録音** (getUserMedia でサンプル直接録音) — ペルソナ的に最も "音楽的" な拡張
- [ ] **エフェクト** (リバーブ、ディレイ、ローパスフィルタ) — Web Audio Effects、シンプル
- [ ] **複数バンク** (A/B/C/D で 64 パッド)
- [ ] **WAV エクスポート** (OfflineAudioContext)
- [ ] **MIDI 入力対応** (Web MIDI API)
- [ ] **クラウド保存** (要バックエンド)

---

## 🔧 技術的負債 (ROADMAP からのコピー)

- [ ] **オーディオレイテンシー測定** — 100ms以内の検証 (実機 + Audio Worklet 計測)
- [ ] **TypeScript 完全移行** — `.jsx` → `.tsx` 化 + 型付け
- [ ] **ユニットテスト** — Vitest で hooks (useSequencer, useAudioEngine) と utils (onsetDetect) を保護
- [ ] **App.jsx の責務分離** — 230行に肥大化。`useChopGroups`, `useAutoChop` フックに切り出し
- [ ] **Tour spotlight モバイル時挙動** — 実機で確認
- [ ] **App.jsx の `selectedSample` 参照順序** — `handleAutoChop` 内で `selectedSample` を使うが、宣言は後 (closure で動くが TypeScript 化時に `no-use-before-define` で問題)

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

最終更新: 2026-05-04 / Cloudflare Pages 初回デプロイ後 / sampler.mymt.casa 稼働中
