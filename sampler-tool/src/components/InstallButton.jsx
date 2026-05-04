import React from 'react';
import './InstallButton.css';

export const InstallButton = ({ canInstall, onClick }) => {
  if (!canInstall) return null;
  return (
    <button
      className="install-btn"
      onClick={onClick}
      title="ホーム画面 / デスクトップにインストール"
      aria-label="Install app"
    >
      <span className="install-icon">↓</span>
      <span className="install-label">INSTALL</span>
    </button>
  );
};
