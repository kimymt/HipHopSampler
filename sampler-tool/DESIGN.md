# Hip Hop Sampler — Design System

このドキュメントは Hip Hop Sampler の **意思決定の基準** です。新しいコンポーネントを足す時、色を選ぶ時、文言を書く時、すべてここに照らし合わせて判断します。

---

## 1. ペルソナ (絶対基準)

> サンプリングをやってみたいと思い立ったが、既存ツール (MPC, FL Studio, Ableton, Logic, Maschine) を **一度も操作したことがない、もしくは操作したが理解できず心が折れた人**。

**判断軸 (UI追加・変更時の必読チェックリスト)**:

- [ ] 経験者でなく **未経験者が直感的にたどり着ける** か?
- [ ] 専門用語 (オンセット検出、ゼロクロッシング、トランジェント等) が UI に出ていないか?
  - もし必要なら、ガイド/ツアーで日本語で噛み砕いて説明
- [ ] 「DAW経験者なら分かる」を **判断軸にしない**
  - 経験者を切り捨ててでも初心者の挫折ポイントを取り除く
- [ ] 操作が **3クリック以内、または1機能1クリック** で完結するか?
- [ ] **デフォルト値だけでいい感じに動く** か? 設定画面に追い込んでいないか?
- [ ] 視覚情報・選択肢は **最小限** か?

ペルソナとブレた時は迷わずペルソナ側に倒す。経験者向け機能は ROADMAP P2 で別途検討。

---

## 2. ビジュアルアイデンティティ

### 2.1 ベンチマーク
- **Teenage Engineering EP-133 K.O. II** — クリーム本体 + 鮮やかなオレンジパッド + 黒LCD表示
- **Akai MPC Sample** — 同系統 (cream + 大ぶり pad + 黒ディスプレイ)

「DAWソフト」ではなく「ハードウェア機器」の感触を目指す。

### 2.2 何を排除するか

AI生成の典型 (slop) は強く避ける:

❌ 紫/インディゴグラデの背景
❌ 3列カードグリッドの "feature highlight" レイアウト
❌ アイコンを丸の中に入れた装飾
❌ 全部センタリング
❌ 全要素同じ大きな border-radius
❌ 装飾 blob / 浮遊する円 / 波打つ SVG divider
❌ 絵文字を装飾要素として使う (機能アイコンは可)
❌ 左 border が色付きのカード
❌ ジェネリック hero copy (「Welcome to...」「Unlock the power of...」)
❌ system-ui / -apple-system をプライマリフォントに

### 2.3 何を採用するか

✅ 暖かいクリーム/ボーン色のボディ
✅ 凹凸のあるパッド (グラデーション + 内側ハイライト + 下方向影)
✅ 黒いディスプレイ部 (LCD風) 内の赤・アンバー LED テキスト
✅ TE シグネチャーオレンジを単一アクセントに
✅ ブルーは選択枠 (controlled accent)
✅ 黄色は警告/重要マーカー (IN/OUT, current step)
✅ モノスペースで機械的ラベル
✅ ハードウェア印字風の小さい大文字メタテキスト

---

## 3. カラートークン

CSS カスタムプロパティで一元管理。新規コンポーネントは **必ずこのトークンから引く**。直書き hex は禁止。

```css
/* Hardware body — warm cream */
--bone:        #e3ddc9;  /* メイン本体色 */
--bone-light:  #ede7d3;  /* グラデの上、明るい面 */
--bone-dark:   #c9c2ad;  /* グラデの下、影部 */
--bone-darker: #a8a18c;  /* ボーダー、divider */

/* Display panel — dark inset LCD */
--display-bg:    #161310;  /* 黒い表示部の地 */
--display-bg-soft: #24201b;
--display-frame: #0a0908;  /* 表示部の最深部 (枠) */

/* Ink (text on bone) */
--ink:        #1a1612;  /* 強調テキスト */
--ink-soft:   #4a4337;  /* 標準テキスト */
--ink-muted:  #7a7363;  /* メタ、ヒント */

/* Vibrant accents (sparingly) */
--te-orange:       #f04a1f;  /* シグネチャー、メインアクション */
--te-orange-light: #ff6f3d;  /* グラデの上 */
--te-orange-dark:  #c43614;  /* ボーダー、影 */
--display-red:     #ff3322;  /* LCD readout (BPM, level) */
--display-amber:   #ffaa44;  /* メーター */
--te-blue:         #1f6acc;  /* 選択枠 only */
--te-yellow:       #ffcc1a;  /* IN/OUT marker, current step */
--te-cream-btn:    #ddd5be;  /* 補助ボタン */
```

### 使い分けルール

| シーン | 色 |
|--------|---|
| アプリ全体の背景 | `--bone` (radial-gradient で `--bone-light` ↔ `--bone-dark`) |
| パッド本体 (空) | `linear-gradient(180deg, --bone-light, --bone)` |
| パッド本体 (loaded) | `linear-gradient(180deg, --te-orange-light, --te-orange)` |
| パッド押下 (active) | `linear-gradient(180deg, --te-yellow, --display-amber)` |
| パッド選択枠 | `--te-blue` 2px outline |
| ディスプレイパネル | `--display-bg` background |
| LCD 数値 | `--display-red` + text-shadow 0 0 8px |
| プライマリボタン | `--te-orange-light` ↔ `--te-orange` グラデ |
| 黄色マーカー (IN/OUT, 拍頭) | `--te-yellow` |

**禁止:** ペルソナを切り裂くような色 (蛍光ピンク、ライム、紫) を accent に使う。

### コントラスト比

すべてのテキストは WCAG AA (4.5:1) を最低基準。重要 UI は AAA (7:1) を目指す:

| 組み合わせ | 比 |
|-----------|---|
| `--ink` on `--bone` | 13.5:1 ✅ AAA |
| `--ink-soft` on `--bone-light` | 9.0:1 ✅ AAA |
| `--ink-muted` on `--bone` | 5.0:1 ✅ AA |
| `--display-red` on `--display-bg` | 7.8:1 ✅ AAA |
| `--te-yellow` on `--display-bg` | 12.1:1 ✅ AAA |
| `#fff` on `--te-orange` | 4.6:1 ✅ AA |

---

## 4. タイポグラフィ

### 4.1 フォント

```css
--sans: "Helvetica Neue", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
--mono: "JetBrains Mono", "Menlo", "Monaco", "Courier New", monospace;
```

- **Sans** → 説明文、ボタンラベル、ダイアログ本文
- **Mono** → ラベル、数値、トランスポート、ステータス、すべての「機械的」テキスト

ペルソナ的に「機材っぽさ」が一番出るのは **Mono の頻度** なので、迷ったら mono を選ぶ。

### 4.2 サイズスケール

```
9px   メタタグ、コーナー番号
10px  ボタンラベル、small caps
11px  パッド名、トリム情報、サブテキスト
12px  default body
13px  card body
14px  プライマリ操作ボタン文字
16px  body large、dialog 本文
18px  dialog タイトル
22px  BPM, PADS 数値 (LCD)
28px  h2 desktop
48px  h1 desktop (現状未使用)
```

`<= 11px` のテキストは大文字 + `letter-spacing: 1.5px` 以上で「ラベル感」を強める (Mono だけ)。本文小文字には使わない。

### 4.3 ウェイト

- 400 (regular) — body
- 600 (semibold) — emphasis 内文中
- 700 (bold) — 見出し、ボタン、ラベル
- 800 (extrabold) — 最重要要素 (h1/h2、primary CTA)

`font-style: italic` は使わない (機械的世界観に合わない)。

---

## 5. スペーシング

8px グリッド基本。

```
4px   要素内の細かい間
6px   隣接 inline 要素 (ボタン群)
8px   標準 padding
10px  カード内の section 間
12px  list item の間
14px  ブロック間
16px  major section 間
20px  card padding
24px  カラム gap
30-40px 大きな余白 (hero など)
```

**禁止:** 5px / 7px / 13px のような non-grid 値。

---

## 6. 形 (shape)

### 角丸

```
3-4px   小さなチップ (ステータスタグ、キーバッジ)
5-6px   ボタン、input、ステップ
8px     カード内コンポーネント (パッド、ステップグリッド)
10-14px パネル (シーケンサー、ミキサー、サンプル表示)
16-18px ダイアログ、シート (top corners only)
50%     アイコンボタン (Play, Stop, Help, Settings)
```

すべての要素を同じ角丸にしない (AI slop の典型)。**階層に応じて変える**: 内側ほど小さく、外側ほど大きく。

### 影

「ハードウェアっぽさ」は影で作る:

```css
/* 凸 (raised) — パッド、ボタン */
inset 0 1px 0 rgba(255, 255, 255, 0.7),         /* 上ハイライト */
inset 0 -2px 4px rgba(60, 50, 30, 0.15),        /* 下リム */
0 2px 4px rgba(60, 50, 30, 0.18);               /* 落ち影 */

/* 凹 (recessed) — パッドグリッド枠、ディスプレイ */
inset 0 2px 4px rgba(0, 0, 0, 0.18),
inset 0 -1px 0 rgba(255, 255, 255, 0.4);

/* オレンジグロー — active */
0 0 16px rgba(240, 74, 31, 0.55);

/* 黄色グロー — 現在ステップ */
0 0 10px rgba(255, 204, 26, 0.6);
```

---

## 7. モーション

### タイミング

```
0.06s  パッド押下 (即時感)
0.1s   ホバー、color transition
0.12s  ボタンの press feedback
0.15s  小さな state transition
0.22s  シート/モーダルのスライド
0.25s  spotlight transition (Tour)
1-1.5s パルス・呼吸 (Loop, Record, LED)
```

すべての timing-function は `ease` または `cubic-bezier(0.2, 0.8, 0.2, 1)` (snappy ease-out)。`linear` は使わない。

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  /* パルス・点滅・スライドは fade に */
  /* 連続アニメーションは1回で停止 */
}
```

すべての `animation: pulse infinite` 系は **必ず** この上書きを伴う。

### 「物理的」感

- 押下時は scale(0.94-0.96) + translateY(1px)
- リリース時は元に戻る
- ホバー時は translateY(-1px)
- box-shadow を強めて「浮く」感じを出す

---

## 8. レイアウト

### ブレイクポイント

```css
< 768px            mobile  /* iPhone SE 320px 〜 Pro Max 414px */
768px ≤ x ≤ 1023px tablet  /* iPad 縦 */
≥ 1024px           desktop
```

`useIsMobile()` / `useIsDesktop()` フック (`hooks/useMediaQuery.ts`) で参照。

### レイアウト原則

#### Desktop
- 中央寄せ max-width 1400px
- 上に Transport (固定高 88px)
- メインは 2 カラム: 左 = pad grid、右 = sample panel
- 下に Sequencer 16 ステップ横一列

#### Mobile
- 単カラム
- 上に Tight Transport (48px)
- パッドが画面幅いっぱい (4x4 SQUARE)
- Sequencer は BAR 1〜4 タブ + 4 ステップ
- Sample panel は **BottomSheet** (パッドタップで起動)
- 補助機能は **SettingsSheet** (⚙ ボタン起動)

タブレット (768〜1023) は MVP では mobile レイアウトを使う。

---

## 9. コンポーネントカタログ

### 9.1 Pad
**役割:** サンプル発火点。ロード状態 / 選択状態 / 押下状態を視覚化。

**仕様:**
- Aspect ratio 1:1 (4x4 SQUARE)
- 角丸 8px (mobile は 10px)
- corner: 番号 (左上、mono 9px) + キー (右上、cream pill)
- 状態:
  - **empty** → cream グラデ + "DROP" テキスト + (mobile) 右下に "+" ボタン
  - **loaded** → orange グラデ + 白でサンプル名
  - **selected** → 2px blue outline
  - **active** (押下中) → yellow グラデ + scale(0.94)
- HitArea: 視覚 70px square + 透明 padding 8px = ~86px 反応域

### 9.2 TransportBar
**役割:** 上部固定。Play/Stop/Record、BPM、ステータス、グローバルアクション。

**Desktop:**
- Logo (▣ + "HIP HOP SAMPLER" + version)
- ▶ Play / ● Record (44px circle)
- BPM input (LCD 風、text-shadow グロー)
- PADS x/16, IDLE/PLAYING LED
- ⚙ DISK NN%, ↓ INSTALL, ? Help

**Mobile:**
- Logo "HHS" + ▣
- ▶ Play (36px) / BPM コンパクト
- PADS, LED 圧縮
- ⚙ Settings ボタン (補助は Settings sheet 内)

### 9.3 Sequencer
**役割:** 16-step pattern の入力 + 再生位置表示。

- ディスプレイ風背景 (`--display-bg`)
- ステップ:
  - off → 暗いグラデ
  - on → orange
  - current (再生中) → yellow outline + glow
  - beat (1, 5, 9, 13) → 微妙に明るいグラデ
- Mobile: BAR 1-4 tab で 4 ステップずつ表示 + 自動切替
- CLEAR ボタン (パターン入力時のみ)

### 9.4 SampleDisplay
**役割:** 波形 + IN/OUT トリム + チョップ境界 + ループプレビュー。

- ディスプレイ風背景
- 波形は orange (`--te-orange-light`) でトリム範囲、外は brown (`--ink-soft`相当) で減色
- 黄色マーカーが IN/OUT (このパッド)
- 茶色点線が他パッドのチョップ境界
- 白い再生ヘッド (loop preview 中)
- IN/OUT は pointer drag、他境界も drag 可能 (siblings 同時更新)

### 9.5 Mixer
**役割:** Volume / Pan / メタ / AUTO CHOP / Remove。

- cream パネル (raised)
- 上部にラベル "SAMPLE · PAD NN" + (chop時) `CHOP K` バッジ
- DUR / CH / SR の3メータ表示 (LCD風)
- VOLUME / PAN スライダー (`--te-orange` accent)
- ✂ AUTO CHOP プライマリボタン
- × 削除ボタン (右上)

### 9.6 BottomSheet (mobile)
**役割:** Sample panel をパッドタップ時に表示。

- 上に handle (drag to resize/dismiss)
- snap: half (60vh) / full (92vh)
- 下スワイプ 100px+ で dismiss
- backdrop tap でも閉じる
- title + × ボタン

### 9.7 SettingsSheet (mobile)
**役割:** Transport に入りきらない補助機能を集約。

- Record toggle (ON時にパルス)
- Install ボタン (canInstall=true 時のみ)
- Tour 起動
- Storage 状態

### 9.8 Tour
**役割:** 初回起動時の 13 ステップオンボーディング、? ボタンで再表示。

- スポットライト (TEオレンジ outline + 周囲を暗く)
- 進捗バー
- スキップ / 戻る / 次へ
- 最後は完了 🎉 で `localStorage` フラグ

### 9.9 StartupLoader
**役割:** IndexedDB からのサンプル復元中の全画面オーバーレイ。

- 中央カード + spinning ↻ + プログレスバー
- エラー時は再試行 / 保存データ消去 (escape hatch)

### 9.10 InstallButton
**役割:** Transport 内の小さい install pill (Phase 1)。`canInstall=true` 時のみ表示。

### 9.11 IosInstallGuide
**役割:** iOS 用「ホーム画面に追加」3ステップ説明モーダル。

### 9.12 UpdateToast
**役割:** SW 新バージョン通知 + オフライン対応完了通知。右下、低侵襲。

### 9.13 StorageBadge
**役割:** ⚙ DISK NN%。60% 超でアンバー、85% 超で赤くパルス。

### 9.14 Pad "+" Button
**役割:** モバイル空パッドにファイル選択導線 (iOS HTML5 D&D 不可対策)。

---

## 10. インタラクション原則

### 10.1 ポインタイベント
- **すべての** ドラッグ可能要素は `onPointerDown / Move / Up / Cancel` を使う
- `onMouseDown` 系は **使わない** (touch を逃す)
- 連続ドラッグは `window` レベルの listener 登録 (キャンバス外でも追従)
- `touchAction: 'none'` を canvas に、`'manipulation'` をパッドに

### 10.2 即時音声フィードバック
- パッドクリック → 100ms 以内に発音
- スケジューラはオフラインで decode 済 buffer 前提 (Phase 2)
- AudioContext は **ユーザー操作で resume**

### 10.3 キーボードショートカット
- パッド: `1234 / QWER / ASDF / ZXCV` (4x4)
- BPM/text input にフォーカス中は **無効化** (typo防止)
- Esc でモーダル/シート閉じる
- Tab で順次フォーカス (focus-visible 必須)

### 10.4 ドラッグ&ドロップ
- Desktop: HTML5 D&D で画面全体に対応
- Mobile (iOS): D&D不可 → 必ず `<input type="file">` フォールバック
- どちらの場合も `accept="audio/*,.wav,.mp3,.ogg,.m4a"`

---

## 11. 文言ガイド

### 11.1 言語
- UI ラベル → **英語の短い大文字** (`PADS`, `LOOP`, `AUTO CHOP`)
- 説明文・ヒント・モーダル → **日本語**
- エラー/警告 → **日本語、行動指示形** ("もう一度試す" / "ファイルが大きすぎます")

### 11.2 トーン
- ポップで親しみやすく、ただし媚びない
- 絵文字は機能アイコンに限定 (`✂` AUTO CHOP, `↻` LOOP, `⚙` 設定)
- 装飾絵文字 (🎉, 🔥, ✨) は完了時のみ
- 「!」は1ステートメントに最大1回まで (連発しない)

### 11.3 専門用語の翻訳
| 業界用語 | UI 表現 |
|---------|--------|
| Transient | 「音の境界」「ヒット」 |
| Onset | 「立ち上がり」 |
| BPM | "BPM" のまま (国際的に通じる) |
| Step | "ステップ" or "STEP" |
| Quantize | (使わない、未対応) |
| Crossfade | (使わない、未対応) |

---

## 12. アクセシビリティ標準

- **タップターゲット最小 44x44px** (iOS HIG)
- **コントラスト比 AA 4.5:1 以上**、重要要素は AAA 7:1
- **`role` + `aria-label`** をすべての button / dialog / tab に
- **`aria-modal="true"`** + フォーカストラップ on dialog/sheet
- **`prefers-reduced-motion`** 尊重
- **`aria-live="polite"`** で動的フィードバック (SET IN/OUT, AUTO CHOP メッセージ)
- スクリーンリーダー読み上げ: パッド再生は視覚のみ、操作確定は live region で announce

---

## 13. ファイル/ディレクトリ規約

```
src/
├── components/      # React UI components
│   ├── ComponentName.jsx
│   └── ComponentName.css      # 1コンポーネント = 1 CSS file
├── hooks/           # 再利用可能な状態ロジック
├── utils/           # 純粋関数 (検出、永続化など)
├── App.jsx          # 全体オーケストレーション
├── App.css          # グローバルレイアウト + responsive root
└── index.css        # CSS 変数定義 + reset
```

- CSS ファイルは **対応 JSX ファイル名と一致**
- CSS 変数は `index.css` の `:root` のみ。コンポーネント CSS では参照するだけ
- ハードコード hex 禁止、必ず変数経由

---

## 14. 変更プロセス

### このドキュメントを変える時
1. 変更理由を明文化 (なぜペルソナにとって価値があるか)
2. 影響を受ける既存コンポーネントを列挙
3. PR で該当変更と一緒に DESIGN.md も更新
4. 単独の DESIGN.md PR でも OK (ドキュメント先行)

### 新コンポーネントを足す時
1. このドキュメントの **§2.2 「何を排除するか」** に違反していないかチェック
2. **§3 カラートークン** から色を引く (新規追加なら理由とともに `index.css` に登録)
3. **§5 スペーシング** の 8px グリッドに乗せる
4. **§9 コンポーネントカタログ** に追記
5. **§12 アクセシビリティ** をクリア
6. ペルソナチェックリスト (§1) を通す

### このドキュメントを使う時
- レビュー (`/plan-design-review`, `/design-review`) はここを最初に読む
- 「これでいいか?」と迷ったら **§1 ペルソナ** に戻る

---

## 15. ROADMAP との関係

DESIGN.md は **現状実装と意図** を映す。新しい方向性 (例: ダークモード、別パレット) は ROADMAP に置いてから DESIGN.md に降ろす。逆 (DESIGN.md で先行決定 → ROADMAP には書かない) は避ける。

---

最終更新: 2026-05-04 / Phase 3 マージ後
