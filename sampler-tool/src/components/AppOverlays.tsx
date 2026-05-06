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
      {micErrorMessage && (
        <div className="mic-error-toast" role="alert" onClick={onMicErrorClear}>
          {micErrorMessage}
        </div>
      )}
    </>
  );
}
