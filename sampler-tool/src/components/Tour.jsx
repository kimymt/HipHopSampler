import React, { useEffect, useState, useLayoutEffect } from 'react';
import './Tour.css';

const STEPS = [
  {
    title: 'ようこそ 👋',
    body: 'Hip Hop Sampler の使い方を1分で案内します。Hip Hopビートを作るのに必要な機能だけに絞っています。',
    target: null,
  },
  {
    title: '① トランスポートバー',
    body: 'ここで再生・録音・テンポを操作します。BPM (1分の拍数) は Hip Hop なら 85〜95 が定番です。',
    target: '.transport-bar',
    position: 'bottom',
  },
  {
    title: '② パッドグリッド',
    body: '4×4 で合計16個のパッドに音声ファイルを割り当てて鳴らします。各パッド右上の英字はキーボードショートカットです。',
    target: '.pad-grid',
    position: 'right',
  },
  {
    title: 'パッドの状態',
    body: 'パッドの色で状態が分かります。クリーム色 (DROP) は空、オレンジ色は読み込み済み、青枠は選択中を表します。クリックすると選択と同時にすぐ再生されます。',
    target: '.pad-grid .pad:nth-child(1)',
    position: 'right',
  },
  {
    title: 'サンプルを読み込む — 3つの方法',
    body: '空パッドには2つの小さなボタンが付いています。左下の 🎙 はマイクから直接録音できます。右下の + は音声ファイル (WAV / MP3) を選択できます。デスクトップでは画面に直接ドラッグ&ドロップしても読み込めます。',
    target: '.pad-grid',
    position: 'right',
  },
  {
    title: '🎙 マイクで録音してみよう',
    body: '一番手軽なサンプリング方法はマイク録音です。空パッド左下の 🎙 をタップして、ブラウザのマイク許可を経て、声や手拍子、楽器など何でも10秒まで録音できます。もう一度タップすると停止します。録音した音はそのままパッドに貼り付くので、すぐに叩けます。',
    target: '.pad-grid .pad:first-child .pad-mic-btn, .pad-grid',
    position: 'right',
  },
  {
    title: '③ サンプル編集パネル',
    body: '選択中のパッドの波形・音量・パン・トリミングをここで編集します。長い音源は ↻ LOOP PLAY で聴きながら SET IN / OUT で位置を決められます。モバイルではロード済みパッドをタップするとシートが下から開きます。',
    target: '.workspace-right, .pad-grid', // desktop fallbacks to pad-grid on mobile
    position: 'left',
  },
  {
    title: '④ シーケンサー',
    body: '16マスで1小節を表します。マスをクリックすると、そのタイミングで選択中のパッドが自動再生されます。',
    target: '.sequencer',
    position: 'top',
  },
  {
    title: '🥁 キックパターン例',
    body: 'シーケンサーの 1, 5, 9, 13 をクリックすると、ダンスミュージック定番の 4-on-the-floor キックになります。4マス毎に薄く色分けされているのが拍頭です。',
    target: '.sequencer-grid',
    position: 'top',
  },
  {
    title: '▶ 再生',
    body: 'パターンを組んだら Play を押すだけで再生が始まります。再生中もシーケンサーは編集できます。再生位置は黄色のカーソルで確認できます。',
    target: '.transport-btn.play',
    position: 'bottom',
  },
  {
    title: '● ライブ録音',
    body: 'Record と Play を同時に押した状態で再生中にパッドを叩くと、その瞬間がパターンに記録されます。演奏感覚でビートを組みたい時に便利です。モバイルでは ⚙ 設定シート内に Record トグルがあります。',
    target: '.transport-btn.record, .settings-btn',
    position: 'bottom',
  },
  {
    title: '⌨ キーボード',
    body: '1234 / QWER / ASDF / ZXCV の4列でパッドを叩けます。マウスより速くて表現力が出ます。BPM入力中は無効化されます。',
    target: '.pad-grid',
    position: 'right',
  },
  {
    title: '💾 自動保存',
    body: 'BPMとシーケンサーパターンはブラウザに自動保存されます。リロードしても残ります。⚠️ 音声ファイル自体は保存されないので、再ドロップが必要です。',
    target: '.transport-bar',
    position: 'bottom',
  },
  {
    title: '🎉 準備OK！',
    body: 'これで一通りの機能を把握できました。困ったら右上の ? ボタンでこのツアーを再生できます。早速ビートを作ってみましょう！\nモバイルでは ⚙ 設定シート内の「操作ガイド」から再表示できます。',
    target: '.tour-help-btn, .settings-btn',
    position: 'bottom',
  },
];

const TOOLTIP_GAP = 14;
const TOOLTIP_W = 360;

const computePosition = (rect, position) => {
  if (!rect) {
    return {
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left, top;
  switch (position) {
    case 'top':
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
      top = rect.top - TOOLTIP_GAP;
      return { left: clamp(left, 12, vw - TOOLTIP_W - 12), top, transform: 'translateY(-100%)' };
    case 'bottom':
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
      top = rect.bottom + TOOLTIP_GAP;
      return { left: clamp(left, 12, vw - TOOLTIP_W - 12), top };
    case 'left':
      left = rect.left - TOOLTIP_GAP;
      top = rect.top + rect.height / 2;
      return { left, top, transform: 'translate(-100%, -50%)' };
    case 'right':
    default:
      left = rect.right + TOOLTIP_GAP;
      top = rect.top + rect.height / 2;
      return { left: Math.min(left, vw - TOOLTIP_W - 12), top, transform: 'translateY(-50%)' };
  }
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export const Tour = ({ open, onClose }) => {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const cur = STEPS[step];
    const update = () => {
      if (!cur.target) {
        setRect(null);
        return;
      }
      // Try each comma-separated selector in order — first match wins.
      // (querySelector with a selector list returns first-in-DOM, not first-in-list,
      // which would pick the wrong element when both targets exist.)
      const selectors = cur.target.split(',').map((s) => s.trim()).filter(Boolean);
      let el = null;
      for (const sel of selectors) {
        el = document.querySelector(sel);
        if (el) break;
      }
      setRect(el ? el.getBoundingClientRect() : null);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const interval = setInterval(update, 200); // catches DOM updates
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      clearInterval(interval);
    };
  }, [step, open]);

  if (!open) return null;

  const cur = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const tooltipStyle = computePosition(rect, cur.position);

  const next = () => {
    if (isLast) {
      onClose(true);
    } else {
      setStep((s) => s + 1);
    }
  };

  const prev = () => setStep((s) => Math.max(0, s - 1));
  const skip = () => onClose(true);

  return (
    <div className="tour-root">
      <div className="tour-backdrop" onClick={skip} />
      {rect && (
        <div
          className="tour-spotlight"
          style={{
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}
      <div className="tour-tooltip" style={{ ...tooltipStyle, width: TOOLTIP_W }}>
        <div className="tour-step-num">
          STEP {step + 1} / {STEPS.length}
        </div>
        <h3 className="tour-title">{cur.title}</h3>
        <p className="tour-body">{cur.body}</p>
        <div className="tour-progress">
          <div className="tour-progress-fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <div className="tour-actions">
          <button className="tour-btn tour-skip" onClick={skip}>
            スキップ
          </button>
          <div className="tour-actions-right">
            {step > 0 && (
              <button className="tour-btn" onClick={prev}>
                ← 戻る
              </button>
            )}
            <button className="tour-btn tour-primary" onClick={next}>
              {isLast ? '完了 🎉' : '次へ →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
