import { useState, useEffect, useMemo } from 'react';
import { FileDropZone } from './components/FileDropZone';
import { TransportBar } from './components/TransportBar';
import { Workspace } from './components/Workspace';
import { AppOverlays } from './components/AppOverlays';
import { SamplePanel } from './components/SamplePanel';
import { useWebLLM } from './hooks/useWebLLM';
import { useAudioContext } from './hooks/useAudioContext';
import { useIsMobile } from './hooks/useMediaQuery';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { usePersistentStorage } from './hooks/usePersistentStorage';
import { usePWA } from './hooks/usePWA';
import { useAudioEngine } from './hooks/useAudioEngine';
import { usePersistedSamples } from './hooks/usePersistedSamples';
import { useStarterPack } from './hooks/useStarterPack';
import { useReferenceTrack } from './hooks/useReferenceTrack';
import { useMicRecorder } from './hooks/useMicRecorder';
import { useSequencer } from './hooks/useSequencer';
import { usePersistedState } from './hooks/usePersistence';
import { useStorageQuota } from './hooks/useStorageQuota';
import { useAutoChop } from './hooks/useAutoChop';
import { useChopGroups } from './hooks/useChopGroups';
import { useEffects } from './hooks/useEffects';
import { usePatternEditor } from './hooks/usePatternEditor';
import { useSampleEditing } from './hooks/useSampleEditing';
import { DEFAULT_FX_STATE } from './effects/types';
import './App.css';

const TOUR_FLAG = 'sampler.tour.completed';

export default function App() {
  const { audioContext, initAudioContext, contextState, isInitialized: audioInit, resumeContext } = useAudioContext();
  const online = useOnlineStatus();
  const persist = usePersistentStorage();
  // Master FX bus: declared early so useAudioEngine can route through it.
  // `bpm` is owned here too because the delay effect tempo-syncs to it.
  const [bpm, setBpm] = usePersistedState('bpm', 90);
  const [fx, setFx] = usePersistedState('fx', DEFAULT_FX_STATE);
  const [fxBypass, setFxBypass] = useState(false);
  const { getMasterInput } = useEffects({ initAudioContext, fx, bpm, bypass: fxBypass });
  const { trigger, loopTrim, stopAll } = useAudioEngine(initAudioContext, getMasterInput);
  const {
    samples,
    restoreState,
    loadSample,
    getSample,
    updateSampleProperty,
    updateMany,
    removeSample,
  } = usePersistedSamples(initAudioContext);
  const starterPack = useStarterPack({
    initAudioContext,
    loadSample,
    hasSampleAt: (padId) => !!getSample(padId)?.buffer,
  });
  const referenceTrack = useReferenceTrack({ initAudioContext });
  const storageInfo = useStorageQuota();
  const pwa = usePWA();
  const ai = useWebLLM();
  const isMobile = useIsMobile();

  const [selectedPadId, setSelectedPadId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [tourOpen, setTourOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sampleSheetOpen, setSampleSheetOpen] = useState(false);
  const [referenceModeOpen, setReferenceModeOpen] = useState(false);

  const { patterns, selectedPattern, recordStep, toggleStep, clearPattern } = usePatternEditor({
    selectedPadId,
    isRecording,
    currentStep,
  });

  const selectedSample = selectedPadId ? getSample(selectedPadId) : null;

  const { handleSetIn, handleSetOut, handleLoopStart, handleTrim, handleRemove } = useSampleEditing({
    selectedPadId,
    getSample,
    updateSampleProperty,
    loopTrim,
    stopAll,
    removeSample,
    onSampleRemoved: () => {
      setSelectedPadId(null);
      setSampleSheetOpen(false);
    },
  });

  const { chopMessage, runAutoChop } = useAutoChop({
    selectedSample,
    selectedPadId,
    stopAll,
    updateMany,
  });
  const { chopBoundaries, handleBoundaryDrag } = useChopGroups({
    selectedSample,
    samples,
    updateMany,
  });

  useSequencer({
    audioContext,
    samples,
    patterns,
    bpm,
    isPlaying,
    onStepChange: setCurrentStep,
    trigger,
  });

  useEffect(() => {
    if (!localStorage.getItem(TOUR_FLAG)) {
      const t = setTimeout(() => setTourOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, []);

  const mic = useMicRecorder({
    onRecorded: (padId, file) => {
      initAudioContext();
      setSelectedPadId(padId);
      loadSample(padId, file);
      persist.maybeRequestOnce();
    },
  });

  useEffect(() => {
    if (!mic.error) return;
    const t = setTimeout(() => mic.clearError(), 5000);
    return () => clearTimeout(t);
  }, [mic.error, mic]);

  const micErrorMessage = useMemo(() => {
    if (!mic.error) return null;
    switch (mic.error) {
      case 'permission-denied':
        return 'マイクの利用が許可されませんでした。ブラウザの設定でこのサイトのマイクを許可してください。';
      case 'no-device':
        return 'マイクが見つかりませんでした。デバイスを確認してください。';
      case 'unsupported':
        return 'このブラウザはマイク録音に未対応です。';
      case 'recorder-failed':
      default:
        return '録音を開始できませんでした。もう一度お試しください。';
    }
  }, [mic.error]);

  const handleTourClose = (completed: boolean) => {
    setTourOpen(false);
    if (completed) localStorage.setItem(TOUR_FLAG, '1');
  };

  const handleFileDrop = (files: File[]) => {
    if (selectedPadId && files.length > 0) {
      initAudioContext();
      loadSample(selectedPadId, files[0]);
      persist.maybeRequestOnce();
    }
  };

  const handlePadClick = (padId: string) => {
    const sample = getSample(padId);
    // Pass padId so the engine chokes any in-flight source for this pad and
    // restarts from the head (re-tap = retrigger, not overlap).
    if (sample && sample.buffer) trigger(sample, 0, padId);
    setSelectedPadId(padId);
    // Mobile: tap = play only; long-press opens the editor (handlePadLongPress).
    // Without this split every tap force-opened the BottomSheet over the grid.
    recordStep(padId);
  };

  const handlePadLongPress = (padId: string) => {
    if (!isMobile) return;
    const sample = getSample(padId);
    if (!sample?.buffer) return;
    setSelectedPadId(padId);
    setSampleSheetOpen(true);
  };

  const handlePadFilePicked = (padId: string, file: File) => {
    initAudioContext();
    setSelectedPadId(padId);
    loadSample(padId, file);
    persist.maybeRequestOnce();
  };

  const handleMicStart = (padId: string) => {
    initAudioContext();
    mic.startRecording(padId);
  };

  const handlePlayToggle = () => {
    initAudioContext();
    setIsPlaying((prev) => {
      const next = !prev;
      if (!next) stopAll();
      return next;
    });
  };

  const loadedCount = Object.values(samples).filter((s: any) => !!s && !!s.buffer).length;

  const samplePanel = (
    <SamplePanel
      selectedSample={selectedSample}
      selectedPadId={selectedPadId}
      chopBoundaries={chopBoundaries}
      onChopBoundaryDrag={handleBoundaryDrag}
      onTrim={handleTrim}
      onLoopStart={handleLoopStart}
      onLoopStop={stopAll}
      onSetIn={handleSetIn}
      onSetOut={handleSetOut}
      onVolumeChange={(v) => selectedPadId && updateSampleProperty(selectedPadId, 'volume', v)}
      onPanChange={(p) => selectedPadId && updateSampleProperty(selectedPadId, 'pan', p)}
      onRemove={handleRemove}
      onAutoChop={runAutoChop}
      chopMessage={chopMessage}
    />
  );

  return (
    <FileDropZone onFileDrop={handleFileDrop}>
      <div className="app">
        <TransportBar
          bpm={bpm}
          onBpmChange={setBpm}
          isPlaying={isPlaying}
          onPlayToggle={handlePlayToggle}
          isRecording={isRecording}
          onRecordToggle={() => setIsRecording((r) => !r)}
          loadedCount={loadedCount}
          onHelpClick={() => setTourOpen(true)}
          canInstall={pwa.canInstall}
          onInstallClick={pwa.promptInstall}
          storageInfo={storageInfo}
          onSettingsClick={() => setSettingsOpen(true)}
          online={online}
        />

        <Workspace
          isMobile={isMobile}
          samples={samples}
          selectedPadId={selectedPadId}
          onPadClick={handlePadClick}
          onPadLongPress={isMobile ? handlePadLongPress : undefined}
          onPadFilePicked={handlePadFilePicked}
          micSupported={mic.supported}
          recordingPadId={mic.recordingPadId}
          recordingElapsedMs={mic.elapsedMs}
          onMicStart={handleMicStart}
          onMicStop={mic.stopRecording}
          getSample={getSample}
          starterPack={starterPack}
          samplePanel={samplePanel}
          fx={fx}
          onFxChange={setFx}
          fxBypass={fxBypass}
          onFxBypassChange={setFxBypass}
          ai={ai}
          selectedPattern={selectedPattern}
          onToggleStep={toggleStep}
          onClearPattern={clearPattern}
          isPlaying={isPlaying}
          currentStep={currentStep}
          selectedSample={selectedSample}
        />
      </div>

      <AppOverlays
        isMobile={isMobile}
        selectedSample={selectedSample}
        selectedPadId={selectedPadId}
        sampleSheetOpen={sampleSheetOpen}
        onSampleSheetClose={() => setSampleSheetOpen(false)}
        samplePanel={samplePanel}
        settingsOpen={settingsOpen}
        onSettingsClose={() => setSettingsOpen(false)}
        isRecording={isRecording}
        onRecordToggle={() => setIsRecording((r) => !r)}
        pwa={pwa}
        storageInfo={storageInfo}
        audioContext={audioContext}
        ai={ai}
        onAiToggle={ai.setOptedIn}
        onTourOpen={() => setTourOpen(true)}
        onReferenceModeOpen={() => {
          setSettingsOpen(false);
          setReferenceModeOpen(true);
        }}
        tourOpen={tourOpen}
        onTourClose={handleTourClose}
        referenceModeOpen={referenceModeOpen}
        referenceTrack={referenceTrack}
        onReferenceModeClose={() => setReferenceModeOpen(false)}
        // Phase 3 B+C: setBpm is the same persisted state used by the BPM
        // stepper, delay tempo-sync, and sequencer scheduler — they all follow.
        onApplyBpm={(newBpm) => setBpm(newBpm)}
        restoreState={restoreState}
        persist={persist}
        contextState={contextState}
        audioInit={audioInit}
        onResumeAudio={() => resumeContext()}
        micErrorMessage={micErrorMessage}
        onMicErrorClear={() => mic.clearError()}
      />
    </FileDropZone>
  );
}
