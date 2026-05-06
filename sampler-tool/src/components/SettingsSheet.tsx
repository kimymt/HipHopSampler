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
  ai?: { state: WebLLMState; optIn: boolean; loadElapsedSec: number } | null;
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

        <SampleSourcesRow />
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
  ai: { state: WebLLMState; optIn: boolean; loadElapsedSec: number };
  onAiToggle?: (on: boolean) => void;
}> = ({ ai, onAiToggle }) => {
  const { state, optIn, loadElapsedSec } = ai;

  const subtitle = (() => {
    if (state.status === 'unsupported') return state.reason;
    if (state.status === 'loading') {
      const pct = Math.round(state.progress * 100);
      // Elapsed seconds give the user motion when WebLLM's own progress
      // callback hasn't fired yet (initial manifest fetch can sit at 0% for
      // 5-15s on a slow connection). Without this, "0%" looks frozen.
      return `${state.text} ${pct}% · ${loadElapsedSec}秒経過`;
    }
    if (state.status === 'error') return `エラー: ${state.message}`;
    if (state.status === 'ready') return '日本語で「ピヨピヨ」「水族館っぽく」と入れると AI が解釈します';
    return '辞書に無い言葉も AI が解釈します (約 300MB ダウンロード)';
  })();

  const disabled = state.status === 'unsupported';
  // When loading hasn't ticked past 0%, show an indeterminate shimmer so the
  // bar is visibly alive. As soon as a real progress number arrives, switch
  // to a determinate bar that fills proportionally.
  const showIndeterminate =
    state.status === 'loading' && state.progress < 0.005 && loadElapsedSec >= 1;

  return (
    <div className="settings-row settings-row-ai">
      <div className="settings-row-label">
        <strong>🤖 AI 提案</strong>
        <span>{subtitle}</span>
        {state.status === 'loading' && (
          <div
            className={`ai-progress-bar ${showIndeterminate ? 'is-indeterminate' : ''}`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(state.progress * 100)}
          >
            <div
              className="ai-progress-fill"
              style={{ width: `${Math.max(2, state.progress * 100)}%` }}
            />
          </div>
        )}
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

/**
 * Phase 2C: external sample sources directory.
 *
 * Curated list of sites where users can find legally-usable hip-hop sample
 * material. The starter kit (synthesized drums, see useStarterPack)
 * unblocks the immediate "I have nothing on the pads" problem; this row
 * solves the "I want richer / more authentic sounds" follow-up.
 *
 * License classes summarized in the link titles so users don't have to
 * read the destination site's fine print just to know what's safe.
 */
const SAMPLE_SOURCES: Array<{ name: string; url: string; lang: 'ja' | 'en'; note: string }> = [
  { name: '魔王魂', url: 'https://maou.audio/', lang: 'ja', note: '商用OK・改変OK・クレジット任意' },
  { name: '効果音ラボ', url: 'https://soundeffect-lab.info/', lang: 'ja', note: '商用無料・報告不要' },
  { name: 'D-elf (HIP HOP)', url: 'https://www.d-elf.com/hip-hop-free-bgm', lang: 'ja', note: 'ヒップホップ・TRAP 専門' },
  { name: 'Pixabay', url: 'https://pixabay.com/sound-effects/search/hip%20hop/', lang: 'en', note: 'No attribution required' },
  { name: 'Freesound (CC0)', url: 'https://freesound.org/search/?q=hip+hop&f=license:%22Creative+Commons+0%22', lang: 'en', note: 'Filtered to CC0 only' },
  { name: 'r-loops Free', url: 'https://r-loops.com/category/sample-packs/free-hip-hop-samples', lang: 'en', note: 'Royalty-free, commercial OK' },
];

const SampleSourcesRow: React.FC = () => (
  <div className="settings-row settings-row-sources">
    <div className="settings-row-label">
      <strong>🎵 サンプル音源を探す</strong>
      <span>合法に使える素材サイト集 (新しいタブで開きます)</span>
      <ul className="sample-source-list">
        {SAMPLE_SOURCES.map((src) => (
          <li key={src.url}>
            <a href={src.url} target="_blank" rel="noopener noreferrer">
              <span className="sample-source-flag">{src.lang === 'ja' ? '🇯🇵' : '🌐'}</span>
              <span className="sample-source-name">{src.name}</span>
              <span className="sample-source-note">{src.note}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  </div>
);
