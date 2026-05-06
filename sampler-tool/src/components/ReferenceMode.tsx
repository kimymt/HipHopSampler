import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ReferenceState } from '../hooks/useReferenceTrack';
import { ReferenceWaveform } from './ReferenceWaveform';
import { buildBeatGrid, estimateBpm } from '../utils/bpmEstimate';
import { useSavedAnalyses } from '../hooks/useSavedAnalyses';
import { SaveAnalysisDialog } from './SaveAnalysisDialog';
import type { SavedAnalysis } from '../utils/referenceStore';
import './ReferenceMode.css';

interface Props {
  state: ReferenceState;
  onImport: (file: File) => void;
  onClear: () => void;
  onClose: () => void;
  /**
   * Phase 3 B+C: applies the (user-adjusted) reference BPM to the main app
   * transport. The transport bar's BPM input + delay tempo-sync follow.
   * Without this, saved analyses would be a "notebook with no use" — see
   * the Phase 3 design doc for why this is non-optional.
   */
  onApplyBpm?: (bpm: number) => void;
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
export const ReferenceMode: React.FC<Props> = ({ state, onImport, onClear, onClose, onApplyBpm }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phase 3a: user-adjustable BPM + grid offset. Initialized from analyzer
  // output, then editable. Reset when a new track is loaded.
  const [userBpm, setUserBpm] = useState<number | null>(null);
  const [userOffsetSec, setUserOffsetSec] = useState(0);

  // Phase 3 B+C: saved analyses + save dialog visibility + selected saved
  // entry (when user is viewing a saved entry from idle state).
  const saved = useSavedAnalyses();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [viewingSavedId, setViewingSavedId] = useState<string | null>(null);
  const viewingSaved = useMemo<SavedAnalysis | null>(
    () => saved.analyses.find((a) => a.id === viewingSavedId) ?? null,
    [saved.analyses, viewingSavedId],
  );
  // Track the file currently in `ready` state so we know when to reset.
  const readyKey = state.status === 'ready' ? state.track.fileName + state.track.durationSec : null;
  useEffect(() => {
    if (state.status === 'ready') {
      setUserBpm(state.analysis.bpm.bpm > 0 ? state.analysis.bpm.bpm : null);
      setUserOffsetSec(0);
    } else if (state.status === 'idle') {
      setUserBpm(null);
      setUserOffsetSec(0);
    }
    // We intentionally key off readyKey, not the whole state object — only
    // a NEW track should reset adjustments, not every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyKey]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImport(file);
    // Reset so the same file can be re-imported after a clear.
    e.target.value = '';
  };

  // BPM adjustment helpers — only meaningful when state is 'ready' AND we
  // have a userBpm set.
  const adjustBpm = (delta: number) => {
    setUserBpm((prev) => {
      const next = (prev ?? 0) + delta;
      // Clamp to the same range estimateBpm uses
      return Math.max(60, Math.min(180, Math.round(next * 2) / 2));
    });
  };

  const halveBpm = () => {
    setUserBpm((prev) => {
      if (!prev) return prev;
      const next = prev / 2;
      // Below MIN_BPM 60 we just refuse — there's no perceptual home there.
      return next < 60 ? prev : Math.round(next);
    });
  };

  const doubleBpm = () => {
    setUserBpm((prev) => {
      if (!prev) return prev;
      const next = prev * 2;
      return next > 180 ? prev : Math.round(next);
    });
  };

  const reanalyze = () => {
    if (state.status !== 'ready') return;
    const e = estimateBpm(state.analysis.onsets);
    if (e.bpm > 0) setUserBpm(e.bpm);
    setUserOffsetSec(0);
  };

  const handleSaveConfirm = async (name: string) => {
    if (state.status !== 'ready') return;
    const effectiveBpm = userBpm ?? state.analysis.bpm.bpm;
    const grid = buildBeatGrid(effectiveBpm, state.track.durationSec, userOffsetSec);
    try {
      await saved.add({
        name,
        bpm: effectiveBpm,
        offsetSec: userOffsetSec,
        beatPositions: grid,
        durationSec: state.track.durationSec,
      });
    } catch (err) {
      console.warn('[reference-mode] save failed', err);
    } finally {
      setSaveDialogOpen(false);
    }
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

        {state.status === 'idle' && !viewingSaved && (
          <>
            {saved.analyses.length > 0 && (
              <SavedAnalysesList
                analyses={saved.analyses}
                onSelect={setViewingSavedId}
                onDelete={(id) => saved.remove(id)}
              />
            )}
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
          </>
        )}

        {state.status === 'idle' && viewingSaved && (
          <SavedAnalysisView
            entry={viewingSaved}
            onApplyBpm={onApplyBpm}
            onBack={() => setViewingSavedId(null)}
            onDelete={async () => {
              await saved.remove(viewingSaved.id);
              setViewingSavedId(null);
            }}
          />
        )}

        {state.status === 'importing' && (
          <div className="reference-mode-importing" aria-live="polite">
            <div className="reference-mode-spinner" aria-hidden="true" />
            <span>デコード中…</span>
          </div>
        )}

        {state.status === 'analyzing' && (
          <div className="reference-mode-importing" aria-live="polite">
            <div className="reference-mode-spinner" aria-hidden="true" />
            <span>BPM とビート位置を解析中…</span>
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
          <ReadyView
            state={state}
            userBpm={userBpm}
            userOffsetSec={userOffsetSec}
            onBpmAdjust={adjustBpm}
            onBpmHalve={halveBpm}
            onBpmDouble={doubleBpm}
            onReanalyze={reanalyze}
            onOffsetDrag={(d) => setUserOffsetSec((prev) => prev + d)}
            onOffsetReset={() => setUserOffsetSec(0)}
            onClear={onClear}
            onSave={() => setSaveDialogOpen(true)}
            onApplyBpm={onApplyBpm}
          />
        )}

        <SaveAnalysisDialog
          open={saveDialogOpen}
          onConfirm={handleSaveConfirm}
          onCancel={() => setSaveDialogOpen(false)}
        />
      </div>
    </div>
  );
};

const formatDuration = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

/**
 * Ready-state subview. Pulled out so the BPM-adjustment hooks live in the
 * top component but rendering keeps tidy. Rebuilds the beat grid from the
 * user-adjusted bpm + offset on every render.
 */
type ReadyViewProps = {
  state: Extract<ReferenceState, { status: 'ready' }>;
  userBpm: number | null;
  userOffsetSec: number;
  onBpmAdjust: (delta: number) => void;
  onBpmHalve: () => void;
  onBpmDouble: () => void;
  onReanalyze: () => void;
  onOffsetDrag: (deltaSec: number) => void;
  onOffsetReset: () => void;
  onClear: () => void;
  /** Phase 3 B+C: open the save dialog (parent handles confirm). */
  onSave: () => void;
  /** Phase 3 B+C: apply current effective BPM to the main app transport. */
  onApplyBpm?: (bpm: number) => void;
};

const ReadyView: React.FC<ReadyViewProps> = ({
  state,
  userBpm,
  userOffsetSec,
  onBpmAdjust,
  onBpmHalve,
  onBpmDouble,
  onReanalyze,
  onOffsetDrag,
  onOffsetReset,
  onClear,
  onSave,
  onApplyBpm,
}) => {
  const effectiveBpm = userBpm ?? state.analysis.bpm.bpm;
  const adjustedGrid = useMemo(
    () => buildBeatGrid(effectiveBpm, state.track.durationSec, userOffsetSec),
    [effectiveBpm, state.track.durationSec, userOffsetSec],
  );

  const userTouched =
    (userBpm !== null && userBpm !== state.analysis.bpm.bpm) || userOffsetSec !== 0;

  return (
    <div className="reference-mode-ready">
      <div className="reference-mode-bpm-panel">
        <div className="reference-mode-bpm-display">
          <div className="reference-mode-bpm-label">BPM</div>
          <div className="reference-mode-bpm-value">
            {effectiveBpm > 0 ? effectiveBpm : '—'}
          </div>
          <div className="reference-mode-bpm-conf">
            {state.analysis.bpm.bpm > 0
              ? `自動推定 ${state.analysis.bpm.bpm} (確度 ${Math.round(state.analysis.bpm.confidence * 100)}%)`
              : '自動推定不可'}
          </div>
        </div>
        <div className="reference-mode-bpm-controls" role="group" aria-label="BPM 調整">
          <button type="button" onClick={() => onBpmAdjust(-0.5)} aria-label="BPM 0.5 下げる" disabled={effectiveBpm <= 60}>
            −
          </button>
          <button type="button" onClick={() => onBpmAdjust(0.5)} aria-label="BPM 0.5 上げる" disabled={effectiveBpm >= 180}>
            +
          </button>
          <button type="button" onClick={onBpmHalve} aria-label="BPM 半分" disabled={effectiveBpm / 2 < 60}>
            ÷2
          </button>
          <button type="button" onClick={onBpmDouble} aria-label="BPM 倍" disabled={effectiveBpm * 2 > 180}>
            ×2
          </button>
          <button type="button" onClick={onReanalyze} className="reference-mode-bpm-reanalyze">
            再解析
          </button>
        </div>
      </div>

      <ReferenceWaveform
        buffer={state.track.buffer}
        onsets={state.analysis.onsets}
        beatGrid={adjustedGrid}
        height={120}
        onOffsetDrag={onOffsetDrag}
      />

      <div className="reference-mode-grid-controls">
        <span className="reference-mode-offset-readout">
          オフセット: <strong>{userOffsetSec >= 0 ? '+' : ''}{userOffsetSec.toFixed(2)}s</strong>
          <span className="reference-mode-grid-hint"> · 波形をドラッグでグリッド移動</span>
        </span>
        {userOffsetSec !== 0 && (
          <button type="button" className="reference-mode-reset-btn" onClick={onOffsetReset}>
            オフセットをリセット
          </button>
        )}
      </div>

      <dl className="reference-mode-meta reference-mode-meta-compact">
        <div>
          <dt>長さ</dt>
          <dd>{formatDuration(state.track.durationSec)}</dd>
        </div>
        <div>
          <dt>表示中ビート数</dt>
          <dd>{adjustedGrid.length}</dd>
        </div>
        <div>
          <dt>検出ヒット数</dt>
          <dd>{state.analysis.onsets.length}</dd>
        </div>
        <div>
          <dt>調整状態</dt>
          <dd className={userTouched ? 'reference-mode-meta-touched' : 'reference-mode-meta-ok'}>
            {userTouched ? '手動調整中' : '自動推定そのまま'}
          </dd>
        </div>
      </dl>

      {state.analysis.bpm.bpm === 0 && (
        <p className="reference-mode-warning">
          BPM を自動推定できませんでした。+/- で手動入力するか、別ファイルでお試しください。
        </p>
      )}

      <div className="reference-mode-actions">
        {onApplyBpm && effectiveBpm > 0 && (
          <button
            type="button"
            className="reference-mode-action-primary"
            onClick={() => onApplyBpm(effectiveBpm)}
            title="アプリ全体の BPM をこの値に設定します"
          >
            🎯 このテンポをアプリに適用 ({effectiveBpm} BPM)
          </button>
        )}
        <button type="button" className="reference-mode-action-secondary" onClick={onSave}>
          💾 解析を保存
        </button>
        <button type="button" className="reference-mode-clear-btn" onClick={onClear}>
          解除
        </button>
      </div>
    </div>
  );
};

/* ─── Saved analyses list (idle state, when entries exist) ───────── */

const SavedAnalysesList: React.FC<{
  analyses: readonly SavedAnalysis[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}> = ({ analyses, onSelect, onDelete }) => (
  <div className="saved-analyses-list">
    <h3 className="saved-analyses-heading">保存済みの解析</h3>
    <ul>
      {analyses.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            className="saved-analyses-item"
            onClick={() => onSelect(a.id)}
            aria-label={`${a.name} を開く`}
          >
            <span className="saved-analyses-name">{a.name}</span>
            <span className="saved-analyses-meta">
              {a.bpm} BPM · {Math.round(a.durationSec)}s
            </span>
          </button>
          <button
            type="button"
            className="saved-analyses-delete"
            onClick={() => {
              if (window.confirm(`「${a.name}」を削除しますか？`)) onDelete(a.id);
            }}
            aria-label={`${a.name} を削除`}
            title="削除"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  </div>
);

/* ─── Saved-entry detail view (no audio, just numbers + apply CTA) ─ */

const SavedAnalysisView: React.FC<{
  entry: SavedAnalysis;
  onApplyBpm?: (bpm: number) => void;
  onBack: () => void;
  onDelete: () => void;
}> = ({ entry, onApplyBpm, onBack, onDelete }) => (
  <div className="saved-analyses-view">
    <div className="saved-analyses-view-header">
      <button type="button" className="saved-analyses-back" onClick={onBack}>
        ← 一覧に戻る
      </button>
    </div>

    <h3 className="saved-analyses-view-title">{entry.name}</h3>

    <div className="saved-analyses-view-disclaimer" role="note">
      この保存データには <strong>BPM とビート位置の数値のみ</strong> が含まれます。
      元の楽曲ファイルは含まれていないため、波形は表示されません。
    </div>

    <dl className="reference-mode-meta">
      <div>
        <dt>BPM</dt>
        <dd className="reference-mode-meta-bpm">{entry.bpm}</dd>
      </div>
      <div>
        <dt>長さ</dt>
        <dd>{formatDuration(entry.durationSec)}</dd>
      </div>
      <div>
        <dt>オフセット</dt>
        <dd>{entry.offsetSec >= 0 ? '+' : ''}{entry.offsetSec.toFixed(2)}s</dd>
      </div>
      <div>
        <dt>ビート位置数</dt>
        <dd>{entry.beatPositions.length}</dd>
      </div>
    </dl>

    <div className="reference-mode-actions">
      {onApplyBpm && (
        <button
          type="button"
          className="reference-mode-action-primary"
          onClick={() => onApplyBpm(entry.bpm)}
        >
          🎯 このテンポをアプリに適用 ({entry.bpm} BPM)
        </button>
      )}
      <button
        type="button"
        className="reference-mode-action-secondary saved-analyses-view-delete"
        onClick={() => {
          if (window.confirm(`「${entry.name}」を削除しますか？`)) onDelete();
        }}
      >
        この解析を削除
      </button>
    </div>
  </div>
);
