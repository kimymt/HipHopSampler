import { ReactNode } from 'react';
import { BottomSheet } from './BottomSheet';
import { SettingsSheet } from './SettingsSheet';
import { Tour } from './Tour';
import { ReferenceMode } from './ReferenceMode';
import { StartupLoader } from './StartupLoader';
import { IosInstallGuide } from './IosInstallGuide';
import { UpdateToast } from './UpdateToast';
import { AudioGate } from './AudioGate';
import { padIdToDisplayString } from '../utils/padId';
import { clearAll } from '../utils/sampleStore';

interface AppOverlaysProps {
  isMobile: boolean;
  selectedSample: any;
  selectedPadId: string | null;
  sampleSheetOpen: boolean;
  onSampleSheetClose: () => void;
  samplePanel: ReactNode;

  settingsOpen: boolean;
  onSettingsClose: () => void;
  isRecording: boolean;
  onRecordToggle: () => void;
  pwa: any;
  storageInfo: any;
  audioContext: AudioContext | null;
  ai: any;
  onAiToggle: (v: boolean) => void;
  onTourOpen: () => void;
  onReferenceModeOpen: () => void;

  tourOpen: boolean;
  onTourClose: (completed: boolean) => void;

  referenceModeOpen: boolean;
  referenceTrack: any;
  onReferenceModeClose: () => void;
  onApplyBpm: (bpm: number) => void;

  restoreState: any;

  persist: any;

  contextState: string;
  audioInit: boolean;
  onResumeAudio: () => void;

  restoreFailures: string[];
  onRemoveFailedSamples: () => Promise<unknown>;
  micErrorMessage: string | null;
  onMicErrorClear: () => void;
}

export function AppOverlays(props: AppOverlaysProps) {
  const {
    isMobile,
    selectedSample,
    selectedPadId,
    sampleSheetOpen,
    onSampleSheetClose,
    samplePanel,
    settingsOpen,
    onSettingsClose,
    isRecording,
    onRecordToggle,
    pwa,
    storageInfo,
    audioContext,
    ai,
    onAiToggle,
    onTourOpen,
    onReferenceModeOpen,
    tourOpen,
    onTourClose,
    referenceModeOpen,
    referenceTrack,
    onReferenceModeClose,
    onApplyBpm,
    restoreState,
    persist,
    contextState,
    audioInit,
    onResumeAudio,
    micErrorMessage,
    onMicErrorClear,
  } = props;

  return (
    <>
      {isMobile && (
        <BottomSheet
          open={sampleSheetOpen && !!selectedSample?.buffer}
          onClose={onSampleSheetClose}
          title={
            selectedSample && selectedPadId
              ? `SAMPLE · PAD ${padIdToDisplayString(selectedPadId)}`
              : 'SAMPLE'
          }
        >
          {samplePanel}
        </BottomSheet>
      )}

      <SettingsSheet
        open={settingsOpen}
        onClose={onSettingsClose}
        isRecording={isRecording}
        onRecordToggle={onRecordToggle}
        canInstall={pwa.canInstall}
        onInstallClick={pwa.promptInstall}
        onHelpClick={onTourOpen}
        storageInfo={storageInfo}
        audioContext={audioContext}
        ai={{ state: ai.state, optIn: ai.optIn, loadElapsedSec: ai.loadElapsedSec }}
        onAiToggle={onAiToggle}
        onReferenceModeOpen={onReferenceModeOpen}
      />

      <Tour open={tourOpen} onClose={onTourClose} />

      {referenceModeOpen && (
        <ReferenceMode
          state={referenceTrack.state}
          onImport={referenceTrack.importFile}
          onClear={referenceTrack.clear}
          onClose={onReferenceModeClose}
          onApplyBpm={onApplyBpm}
        />
      )}

      <StartupLoader
        status={restoreState.status}
        progress={restoreState.progress}
        total={restoreState.total}
        error={restoreState.error}
        onRetry={() => window.location.reload()}
        onClear={async () => {
          await clearAll();
          window.location.reload();
        }}
      />
      <IosInstallGuide open={pwa.showIosGuide} onClose={pwa.dismissIosGuide} />
      <UpdateToast
        offlineReady={pwa.offlineReady}
        persistResult={persist.recentlyResolved ? persist.lastResult : null}
        onDismissOffline={pwa.dismissOfflineReady}
        onDismissPersist={persist.dismiss}
      />
      <AudioGate
        contextState={contextState}
        isInitialized={audioInit}
        onResume={onResumeAudio}
      />
      {(props.restoreFailures.length > 0 || micErrorMessage) && (
        <div className="mic-error-toast" role="alert">
          {props.restoreFailures.length > 0 && (
            <>
              <p>一部の音声を復元できませんでした。パッド {props.restoreFailures.map(padIdToDisplayString).join(', ')} の保存データは残っています。短い音声に差し替えるか、削除してください。</p>
              <button type="button" onClick={() => void props.onRemoveFailedSamples()}>読み込めなかった音声を削除</button>
            </>
          )}
          {micErrorMessage && <p>{micErrorMessage}</p>}
          {micErrorMessage && <button type="button" onClick={onMicErrorClear}>閉じる</button>}
        </div>
      )}
    </>
  );
}
