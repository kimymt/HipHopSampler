import React, { useEffect, useRef, useState } from 'react';
import './SaveAnalysisDialog.css';

interface Props {
  open: boolean;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

/**
 * Save-analysis confirmation dialog.
 *
 * Required affordances (per the export-guardrail TODO and the Reference
 * Mode legal posture):
 *   - Disclaimer text "音声データは含まれません" is permanent, not behind
 *     a checkbox. The user reads it every save.
 *   - The user must enter their own name. We do NOT pre-fill from the
 *     original filename — that data is not even held by the time this
 *     dialog opens, so there's no way to slip in author/title metadata.
 *   - Save is disabled until the name has at least 1 non-whitespace char.
 *
 * This dialog handles only the consent + name flow. The actual write to
 * IndexedDB happens in the parent (`onConfirm`).
 */
export const SaveAnalysisDialog: React.FC<Props> = ({ open, onConfirm, onCancel }) => {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      // Focus the name field after mount paint.
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  if (!open) return null;

  const trimmed = name.trim();
  const canSave = trimmed.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onConfirm(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="save-analysis-root" role="dialog" aria-modal="true" aria-labelledby="save-analysis-title">
      <form className="save-analysis-panel" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
        <h3 id="save-analysis-title" className="save-analysis-title">
          解析を保存
        </h3>

        <div className="save-analysis-disclaimer" role="note">
          <strong>保存される内容</strong>
          <ul>
            <li>BPM 値</li>
            <li>ビート位置の数値配列</li>
            <li>あなたが付けた名前</li>
          </ul>
          <strong>保存されない内容</strong>
          <ul>
            <li>楽曲ファイル本体 (音声データ)</li>
            <li>元のファイル名・アーティスト情報</li>
            <li>波形データ</li>
          </ul>
        </div>

        <label className="save-analysis-name-label">
          名前
          <input
            ref={inputRef}
            type="text"
            className="save-analysis-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="例: Track A の感じ"
            maxLength={60}
            aria-required
          />
        </label>

        <div className="save-analysis-actions">
          <button type="button" className="save-analysis-cancel" onClick={onCancel}>
            キャンセル
          </button>
          <button type="submit" className="save-analysis-confirm" disabled={!canSave}>
            この内容で保存
          </button>
        </div>
      </form>
    </div>
  );
};
