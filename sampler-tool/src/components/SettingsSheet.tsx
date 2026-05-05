import React from 'react';
import { StorageBadge } from './StorageBadge';
import { LatencyBadge } from './LatencyBadge';
import { TOUR_STEP_COUNT } from './Tour';
import type { WebLLMState } from '../ai/webllmClient';
import './SettingsSheet.css';

/**
 * Mobile settings sheet — collects auxiliary controls that don't fit the
 * tight transport bar: Record, Install, Help (Tour), Storage status.
 */
export const SettingsSheet = ({
  open,
  onClose,
  isRecording,
  onRecordToggle,
  canInstall,
  onInstallClick,
  onHelpClick,
  storageInfo,
  audioContext = null,
  // Phase 2B: WebLLM opt-in. Optional so callers that haven't wired it yet
  // (or test fixtures) keep working — the row only renders when ai is passed.
  ai = null,
  onAiToggle,
}: {
  open: boolean;
  onClose: () => void;
  isRecording: boolean;
  onRecordToggle: () => void;
  canInstall: boolean;
  onInstallClick: () => void;
  onHelpClick: () => void;
  storageInfo: unknown;
  audioContext?: AudioContext | null;
  ai?: { state: WebLLMState; optIn: boolean } | null;
  onAiToggle?: (on: boolean) => void;
}) => {
  if (!open) return null;
  return (
    <div className="settings-root" onClick={onClose} role="dialog" aria-modal="true">
      <div className="settings-card" onClick={(e) => e.stopPropagation()}>
        <div className="settings-handle" />
        <div className="settings-header">
          <h3>設定</h3>
          <button className="settings-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="settings-row">
          <div className="settings-row-label">
            <strong>● 録音モード</strong>
            <span>再生中にパッドを叩いた瞬間を記録</span>
          </div>
          <button
            className={`settings-toggle ${isRecording ? 'on' : ''}`}
            onClick={() => { onRecordToggle(); }}
            aria-pressed={isRecording}
          >
            {isRecording ? 'ON' : 'OFF'}
          </button>
        </div>

        {canInstall && (
          <div className="settings-row">
            <div className="settings-row-label">
              <strong>↓ ホーム画面に追加</strong>
              <span>アプリのようにスタンドアロン起動できる</span>
            </div>
            <button
              className="settings-action primary"
              onClick={() => { onInstallClick(); onClose(); }}
            >
              インストール
            </button>
          </div>
        )}

        <div className="settings-row">
          <div className="settings-row-label">
            <strong>? 操作ガイド</strong>
            <span>{TOUR_STEP_COUNT}ステップのツアーを再生</span>
          </div>
          <button
            className="settings-action"
            onClick={() => { onHelpClick(); onClose(); }}
          >
            開く
          </button>
        </div>

        <div className="settings-row">
          <div className="settings-row-label">
            <strong>💾 ストレージ</strong>
            <span>サンプルとパターンの保存状態</span>
          </div>
          <StorageBadge info={storageInfo} />
        </div>

        <div className="settings-row">
          <div className="settings-row-label">
            <strong>⚡ オーディオ遅延</strong>
            <span>パッドを叩いてから音が出るまでの実測値</span>
          </div>
          <LatencyBadge audioContext={audioContext} />
        </div>

        {ai && <AiSuggestionRow ai={ai} onAiToggle={onAiToggle} />}
      </div>
    </div>
  );
};

/**
 * AI suggestion (WebLLM) opt-in row.
 *
 * UX rules:
 *   - When unsupported (no WebGPU), show a disabled state with the reason.
 *     Don't hide the row — users on iOS may want to know it's a real feature
 *     that just isn't available on their browser yet.
 *   - When loading, show a percentage so 300MB downloads have visible progress.
 *   - When ready, show ON pill identical to the Record row for consistency.
 */
const AiSuggestionRow: React.FC<{
  ai: { state: WebLLMState; optIn: boolean };
  onAiToggle?: (on: boolean) => void;
}> = ({ ai, onAiToggle }) => {
  const { state, optIn } = ai;

  const subtitle = (() => {
    if (state.status === 'unsupported') return state.reason;
    if (state.status === 'loading') {
      const pct = Math.round(state.progress * 100);
      return `${state.text} (${pct}%)`;
    }
    if (state.status === 'error') return `エラー: ${state.message}`;
    if (state.status === 'ready') return '日本語で「ピヨピヨ」「水族館っぽく」と入れると AI が解釈します';
    return '辞書に無い言葉も AI が解釈します (約 300MB ダウンロード)';
  })();

  const disabled = state.status === 'unsupported';

  return (
    <div className="settings-row">
      <div className="settings-row-label">
        <strong>🤖 AI 提案</strong>
        <span>{subtitle}</span>
      </div>
      <button
        className={`settings-toggle ${optIn && state.status !== 'unsupported' ? 'on' : ''}`}
        onClick={() => onAiToggle?.(!optIn)}
        disabled={disabled}
        aria-pressed={optIn && state.status !== 'unsupported'}
        aria-disabled={disabled}
        title={state.status === 'unsupported' ? state.reason : undefined}
      >
        {state.status === 'loading' ? `${Math.round(state.progress * 100)}%` : optIn ? 'ON' : 'OFF'}
      </button>
    </div>
  );
};
