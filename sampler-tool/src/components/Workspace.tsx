import { ReactNode } from 'react';
import { PadGrid } from './PadGrid';
import { Sequencer } from './Sequencer';
import { EffectPanel } from './EffectPanel';

const STARTER_PADS = ['0-0', '0-1', '0-2', '0-3', '1-0', '1-1', '1-2', '1-3'];

interface WorkspaceProps {
  isMobile: boolean;

  // Pad grid
  samples: any;
  selectedPadId: string | null;
  onPadClick: (padId: string) => void;
  onPadLongPress: (padId: string) => void;
  onPadFilePicked: (padId: string, file: File) => void;
  micSupported: boolean;
  recordingPadId: string | null;
  recordingElapsedMs: number;
  onMicStart: (padId: string) => void;
  onMicStop: () => void;

  // Starter kit
  getSample: (padId: string) => any;
  starterPack: any;

  // Sample panel (desktop only)
  samplePanel: ReactNode;

  // Effects
  fx: any;
  onFxChange: (fx: any) => void;
  fxBypass: boolean;
  onFxBypassChange: (b: boolean) => void;
  ai: any;

  // Sequencer
  selectedPattern: boolean[] | null;
  onToggleStep: (stepIdx: number) => void;
  onClearPattern: () => void;
  isPlaying: boolean;
  currentStep: number;
  selectedSample: any;
}

export function Workspace(props: WorkspaceProps) {
  const {
    isMobile,
    samples,
    selectedPadId,
    onPadClick,
    onPadLongPress,
    onPadFilePicked,
    micSupported,
    recordingPadId,
    recordingElapsedMs,
    onMicStart,
    onMicStop,
    getSample,
    starterPack,
    samplePanel,
    fx,
    onFxChange,
    fxBypass,
    onFxBypassChange,
    ai,
    selectedPattern,
    onToggleStep,
    onClearPattern,
    isPlaying,
    currentStep,
    selectedSample,
  } = props;

  const someStarterPadEmpty = STARTER_PADS.some((id) => !getSample(id)?.buffer);

  return (
    <main className="app-main">
      <div className="workspace">
        <section className="workspace-left">
          <h2 className="section-label">
            <span className="section-label-text">
              <span className="dot"></span>
              {isMobile ? 'PADS · タップで再生 / 長押しで編集' : 'PADS · クリック / キーで再生'}
            </span>
            {someStarterPadEmpty && (
              <button
                type="button"
                className="starter-kit-btn"
                onClick={() => starterPack.loadStarterPack()}
                disabled={starterPack.loading}
                title="ヒップホップの基本ドラム 8 音をパッド 1-8 にロード"
                aria-label="スタータキットをロード"
              >
                {starterPack.loading ? '読み込み中…' : '🎁 スタータキット'}
              </button>
            )}
          </h2>
          <PadGrid
            samples={samples}
            onPadClick={onPadClick}
            onPadLongPress={onPadLongPress}
            selectedPadId={selectedPadId}
            onPadFilePicked={onPadFilePicked}
            micSupported={micSupported}
            recordingPadId={recordingPadId}
            recordingElapsedMs={recordingElapsedMs}
            onMicStart={onMicStart}
            onMicStop={onMicStop}
          />
          <div className="hint-text">
            {isMobile
              ? '🎙 でマイク録音 · "+" でファイル選択 · パッドタップで再生・編集'
              : 'パッド左下 🎙 でマイク録音 / 右下 "+" でファイル選択 / WAV・MP3 をドラッグ&ドロップでもOK'}
          </div>
        </section>

        {!isMobile && (
          <section className="workspace-right">
            <h2 className="section-label">
              <span className="dot"></span>
              サンプル
            </h2>
            {samplePanel}
          </section>
        )}
      </div>

      <section className="workspace-fx">
        <EffectPanel
          fx={fx}
          onFxChange={onFxChange}
          bypass={fxBypass}
          onBypassChange={onFxBypassChange}
          aiState={ai.state}
          onAiInfer={ai.infer}
        />
      </section>

      <section className="workspace-bottom">
        <Sequencer
          pattern={selectedPattern}
          onToggleStep={onToggleStep}
          onClear={onClearPattern}
          currentStep={isPlaying ? currentStep : -1}
          selectedPadId={selectedPadId}
          sampleName={selectedSample?.name?.split('.')[0]}
        />
      </section>
    </main>
  );
}
