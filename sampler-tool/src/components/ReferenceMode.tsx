import React, { useRef } from 'react';
import type { ReferenceState } from '../hooks/useReferenceTrack';
import './ReferenceMode.css';

interface Props {
  state: ReferenceState;
  onImport: (file: File) => void;
  onClear: () => void;
  onClose: () => void;
}

/**
 * Reference Mode panel — Phase 1: file picker + validation + status display.
 *
 * Visual contract:
 *   - The orange "REFERENCE MODE" header is permanent while the panel is
 *     open. It signals to the user that they're in a special learning mode,
 *     not the normal sampler workspace.
 *   - The "解析データは保存されません" notice appears prominently. This is
 *     the legal-defense affordance from the dev brief §2: every interaction
 *     reminds the user that this is private learning use only.
 *   - Phase 2 will mount the waveform display + beat overlay below the
 *     status block; the panel is sized to leave room.
 */
export const ReferenceMode: React.FC<Props> = ({ state, onImport, onClear, onClose }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImport(file);
    // Reset so the same file can be re-imported after a clear.
    e.target.value = '';
  };

  return (
    <div className="reference-mode-root" role="dialog" aria-modal="true" aria-labelledby="reference-mode-title">
      <div className="reference-mode-panel" onClick={(e) => e.stopPropagation()}>
        <header className="reference-mode-header">
          <div className="reference-mode-mark">REFERENCE MODE</div>
          <button
            type="button"
            className="reference-mode-close"
            onClick={onClose}
            aria-label="リファレンスモードを閉じる"
          >
            ×
          </button>
        </header>

        <div className="reference-mode-disclaimer" role="note">
          📚 学習用：解析データは端末内でのみ処理され、サーバーへ送信・保存されません
        </div>

        <h2 id="reference-mode-title" className="reference-mode-title">
          {state.status === 'ready'
            ? state.track.fileName
            : '楽曲ファイルを選んで構造を解析'}
        </h2>

        {state.status === 'idle' && (
          <div className="reference-mode-empty">
            <p>
              既存の楽曲を読み込むと、BPM とビート位置を自動抽出して
              「どこで何を叩くか」のお手本になります。
            </p>
            <p className="reference-mode-empty-detail">
              MP3 / WAV / OGG / M4A / FLAC に対応・100MB まで・著作権保護
              (DRM) のあるファイルは解析できません
            </p>
            <button
              type="button"
              className="reference-mode-pick-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              ファイルを選ぶ
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm,.opus"
              onChange={handleFileChange}
              hidden
              aria-hidden="true"
            />
          </div>
        )}

        {state.status === 'importing' && (
          <div className="reference-mode-importing" aria-live="polite">
            <div className="reference-mode-spinner" aria-hidden="true" />
            <span>デコード中…</span>
          </div>
        )}

        {state.status === 'error' && (
          <div className="reference-mode-error" role="alert">
            <strong>読み込めませんでした</strong>
            <p>{state.message}</p>
            <button
              type="button"
              className="reference-mode-pick-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              別のファイルを選ぶ
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm,.opus"
              onChange={handleFileChange}
              hidden
              aria-hidden="true"
            />
          </div>
        )}

        {state.status === 'ready' && (
          <div className="reference-mode-ready">
            <dl className="reference-mode-meta">
              <div>
                <dt>長さ</dt>
                <dd>{formatDuration(state.track.durationSec)}</dd>
              </div>
              <div>
                <dt>サンプルレート</dt>
                <dd>{state.track.buffer.sampleRate.toLocaleString()} Hz</dd>
              </div>
              <div>
                <dt>チャンネル</dt>
                <dd>{state.track.buffer.numberOfChannels}</dd>
              </div>
              <div>
                <dt>ステータス</dt>
                <dd className="reference-mode-meta-ok">読み込み完了</dd>
              </div>
            </dl>
            <p className="reference-mode-next">
              <em>次のステップ:</em> BPM とビート位置の抽出 + 波形表示
              (Phase 2 で実装予定)
            </p>
            <button type="button" className="reference-mode-clear-btn" onClick={onClear}>
              解除
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const formatDuration = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};
