import React from 'react';
import './IosInstallGuide.css';

export const IosInstallGuide = ({ open, onClose }) => {
  if (!open) return null;
  return (
    <div className="ios-guide-root" onClick={onClose}>
      <div className="ios-guide-card" onClick={(e) => e.stopPropagation()}>
        <div className="ios-guide-header">
          <h3>ホーム画面に追加</h3>
          <button className="ios-guide-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p className="ios-guide-intro">
          iOS Safariはアプリと同じように扱える「ホーム画面追加」を手動で行います。3ステップで完了:
        </p>
        <ol className="ios-guide-steps">
          <li>
            <span className="step-num">1</span>
            画面下部の <strong className="ios-icon">⬆︎</strong> 共有ボタンをタップ
          </li>
          <li>
            <span className="step-num">2</span>
            メニューを下にスクロール → <strong>「ホーム画面に追加」</strong> を選ぶ
          </li>
          <li>
            <span className="step-num">3</span>
            右上の <strong>「追加」</strong> をタップ
          </li>
        </ol>
        <p className="ios-guide-note">
          ホーム画面のアイコンから起動するとフルスクリーン表示になり、サンプルもオフラインで使えるようになります。
        </p>
        <button className="ios-guide-ok" onClick={onClose}>OK</button>
      </div>
    </div>
  );
};
