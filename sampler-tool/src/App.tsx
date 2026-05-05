import React, { useState, useEffect, useMemo } from 'react';
import { FileDropZone } from './components/FileDropZone';
import { PadGrid } from './components/PadGrid';
import { SampleDisplay } from './components/SampleDisplay';
import { TransportBar } from './components/TransportBar';
import { Sequencer } from './components/Sequencer';
import { Mixer } from './components/Mixer';
import { Tour } from './components/Tour';
import { IosInstallGuide } from './components/IosInstallGuide';
import { UpdateToast } from './components/UpdateToast';
import { StartupLoader } from './components/StartupLoader';
import { BottomSheet } from './components/BottomSheet';
import { SettingsSheet } from './components/SettingsSheet';
import { AudioGate } from './components/AudioGate';
import { OfflineBadge } from './components/OfflineBadge';
import { useAudioContext } from './hooks/useAudioContext';
import { useIsMobile } from './hooks/useMediaQuery';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { usePersistentStorage } from './hooks/usePersistentStorage';
import { usePWA } from './hooks/usePWA';
import { useAudioEngine } from './hooks/useAudioEngine';
import { usePersistedSamples } from './hooks/usePersistedSamples';
import { useMicRecorder } from './hooks/useMicRecorder';
import { useSequencer } from './hooks/useSequencer';
import { usePersistedState } from './hooks/usePersistence';
import { useStorageQuota } from './hooks/useStorageQuota';
import { useAutoChop } from './hooks/useAutoChop';
import { useChopGroups } from './hooks/useChopGroups';
import { useEffects } from './hooks/useEffects';
import { DEFAULT_FX_STATE } from './effects/types';
import { EffectPanel } from './components/EffectPanel';
import { padIdToDisplayString } from './utils/padId';
import { clearAll } from './utils/sampleStore';
import './App.css';

const TOUR_FLAG = 'sampler.tour.completed';

export default function App() {
  const { audioContext, initAudioContext, contextState, isInitialized: audioInit, resumeContext } = useAudioContext();
  const online = useOnlineStatus();
  const persist = usePersistentStorage();
  // Master FX bus: declared early so useAudioEngine can route through it.
  // `bpm` is owned here too (was lower in file) because the delay effect
  // needs to tempo-sync to it.
  const [bpm, setBpm] = usePersistedState('bpm', 90);
  const [fx, setFx] = usePersistedState('fx', DEFAULT_FX_STATE);
  const [fxBypass, setFxBypass] = useState(false);
  const { getMasterInput } = useEffects({
    initAudioContext,
    fx,
    bpm,
    bypass: fxBypass,
  });
  const { trigger, loopTrim, stopAll } = useAudioEngine(initAudioContext, getMasterInput);
  const {
    samples,
    restoreState,
    loadSample,
    getSample,
    updateSampleProperty,
    updateMany,
    setSample,
    removeSample,
  } = usePersistedSamples(initAudioContext);
  const storageInfo = useStorageQuota();
  const [selectedPadId, setSelectedPadId] = useState(null);
  const [patterns, setPatterns] = usePersistedState('patterns', {});
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [tourOpen, setTourOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sampleSheetOpen, setSampleSheetOpen] = useState(false);
  const pwa = usePWA();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!localStorage.getItem(TOUR_FLAG)) {
      const t = setTimeout(() => setTourOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, []);

  const handleTourClose = (completed) => {
    setTourOpen(false);
    if (completed) localStorage.setItem(TOUR_FLAG, '1');
  };

  const handleFileDrop = (files) => {
    if (selectedPadId && files.length > 0) {
      initAudioContext();
      loadSample(selectedPadId, files[0]);
      // First successful load is a good moment to ask the OS to keep
      // our IDB safe from quota eviction.
      persist.maybeRequestOnce();
    }
  };

  const handlePadClick = (padId) => {
    const sample = getSample(padId);
    if (sample && sample.buffer) {
      trigger(sample);
    }
    setSelectedPadId(padId);

    // On mobile, opening the sample sheet only when the pad has audio.
    // Empty pads don't open the sheet — the "+" button on the pad handles file pick.
    if (isMobile && sample?.buffer) {
      setSampleSheetOpen(true);
    }

    if (isRecording && currentStep >= 0) {
      setPatterns((prev) => {
        const cur = prev[padId] || new Array(16).fill(false);
        const next = [...cur];
        next[currentStep] = true;
        return { ...prev, [padId]: next };
      });
    }
  };

  const handlePadFilePicked = (padId, file) => {
    initAudioContext();
    setSelectedPadId(padId);
    loadSample(padId, file);
    persist.maybeRequestOnce();
  };

  const mic = useMicRecorder({
    onRecorded: (padId, file) => {
      initAudioContext();
      setSelectedPadId(padId);
      loadSample(padId, file);
      persist.maybeRequestOnce();
    },
  });

  const handleMicStart = (padId) => {
    initAudioContext();
    mic.startRecording(padId);
  };

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

  useEffect(() => {
    if (!mic.error) return;
    const t = setTimeout(() => mic.clearError(), 5000);
    return () => clearTimeout(t);
  }, [mic.error, mic]);

  // Selected sample is derived once and consumed by every downstream handler /
  // hook below. Declared early so handlers don't reference it before init
  // (was a `no-use-before-define` smell in the pre-refactor flow).
  const selectedSample = selectedPadId ? getSample(selectedPadId) : null;

  const handleToggleStep = (stepIdx) => {
    if (!selectedPadId) return;
    setPatterns((prev) => {
      const cur = prev[selectedPadId] || new Array(16).fill(false);
      const next = [...cur];
      next[stepIdx] = !next[stepIdx];
      return { ...prev, [selectedPadId]: next };
    });
  };

  const handlePlayToggle = () => {
    initAudioContext();
    setIsPlaying((prev) => {
      const next = !prev;
      if (!next) stopAll();
      return next;
    });
  };

  const handleClearPattern = () => {
    if (!selectedPadId) return;
    setPatterns((prev) => {
      const next = { ...prev };
      delete next[selectedPadId];
      return next;
    });
  };

  const handleLoopStart = () => {
    if (!selectedPadId) return null;
    stopAll();
    return loopTrim(() => getSample(selectedPadId));
  };

  const handleSetIn = (time) => {
    if (!selectedPadId) return;
    const cur = getSample(selectedPadId);
    if (!cur) return;
    const next = Math.max(0, Math.min(time, cur.endTime - 0.01));
    updateSampleProperty(selectedPadId, 'startTime', next);
  };

  const handleSetOut = (time) => {
    if (!selectedPadId) return;
    const cur = getSample(selectedPadId);
    if (!cur) return;
    const next = Math.max(cur.startTime + 0.01, Math.min(time, cur.buffer.duration));
    updateSampleProperty(selectedPadId, 'endTime', next);
  };

  // ── AUTO CHOP + chop group boundaries ─────────────────────
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

  const selectedPattern = selectedPadId ? patterns[selectedPadId] : null;
  const loadedCount = Object.values(samples).filter((s) => !!s && !!s.buffer).length;

  // Wrap in a flex column so SampleDisplay (waveform) and Mixer (pad info)
  // get clean vertical separation. Without the gap they used to abut each
  // other inside the BottomSheet body, making the boundary visually unclear.
  const samplePanel = (
    <div className="sample-panel-stack">
      <SampleDisplay
        sample={selectedSample}
        chopBoundaries={chopBoundaries}
        onChopBoundaryDrag={handleBoundaryDrag}
        onTrim={(start, end) => {
          updateSampleProperty(selectedPadId, 'startTime', start);
          updateSampleProperty(selectedPadId, 'endTime', end);
        }}
        onLoopStart={handleLoopStart}
        onLoopStop={stopAll}
        onSetIn={handleSetIn}
        onSetOut={handleSetOut}
      />
      <Mixer
        sample={selectedSample}
        padId={selectedPadId}
        onVolumeChange={(v) => updateSampleProperty(selectedPadId, 'volume', v)}
        onPanChange={(p) => updateSampleProperty(selectedPadId, 'pan', p)}
        onRemove={() => {
          stopAll();
          removeSample(selectedPadId);
          setSelectedPadId(null);
          setSampleSheetOpen(false);
        }}
        onAutoChop={runAutoChop}
        chopMessage={chopMessage}
      />
    </div>
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

        <main className="app-main">
          <div className="workspace">
            <section className="workspace-left">
              <div className="section-label">
                <span className="dot"></span>
                PADS · click or press key
              </div>
              <PadGrid
                samples={samples}
                onPadClick={handlePadClick}
                selectedPadId={selectedPadId}
                onPadFilePicked={handlePadFilePicked}
                micSupported={mic.supported}
                recordingPadId={mic.recordingPadId}
                recordingElapsedMs={mic.elapsedMs}
                onMicStart={handleMicStart}
                onMicStop={mic.stopRecording}
              />
              <div className="hint-text">
                {isMobile
                  ? '🎙 でマイク録音 · "+" でファイル選択 · パッドタップで再生・編集'
                  : 'パッド左下 🎙 でマイク録音 / 右下 "+" でファイル選択 / WAV・MP3 をドラッグ&ドロップでもOK'}
              </div>
            </section>

            {!isMobile && (
              <section className="workspace-right">
                <div className="section-label">
                  <span className="dot"></span>
                  SAMPLE
                </div>
                {samplePanel}
              </section>
            )}
          </div>

          <section className="workspace-fx">
            <EffectPanel
              fx={fx}
              onFxChange={setFx}
              bypass={fxBypass}
              onBypassChange={setFxBypass}
            />
          </section>

          <section className="workspace-bottom">
            <Sequencer
              pattern={selectedPattern}
              onToggleStep={handleToggleStep}
              onClear={handleClearPattern}
              currentStep={isPlaying ? currentStep : -1}
              selectedPadId={selectedPadId}
              sampleName={selectedSample?.name?.split('.')[0]}
            />
          </section>
        </main>
      </div>

      {isMobile && (
        <BottomSheet
          open={sampleSheetOpen && !!selectedSample?.buffer}
          onClose={() => setSampleSheetOpen(false)}
          title={selectedSample && selectedPadId ? `SAMPLE · PAD ${padIdToDisplayString(selectedPadId)}` : 'SAMPLE'}
        >
          {samplePanel}
        </BottomSheet>
      )}

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        isRecording={isRecording}
        onRecordToggle={() => setIsRecording((r) => !r)}
        canInstall={pwa.canInstall}
        onInstallClick={pwa.promptInstall}
        onHelpClick={() => setTourOpen(true)}
        storageInfo={storageInfo}
        audioContext={audioContext}
      />

      <Tour open={tourOpen} onClose={handleTourClose} />
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
        needRefresh={pwa.needRefresh}
        offlineReady={pwa.offlineReady}
        persistResult={persist.recentlyResolved ? persist.lastResult : null}
        onApply={pwa.applyUpdate}
        onDismissUpdate={pwa.dismissUpdate}
        onDismissOffline={pwa.dismissOfflineReady}
        onDismissPersist={persist.dismiss}
      />
      <AudioGate
        contextState={contextState}
        isInitialized={audioInit}
        onResume={() => resumeContext()}
      />
      {micErrorMessage && (
        <div className="mic-error-toast" role="alert" onClick={() => mic.clearError()}>
          {micErrorMessage}
        </div>
      )}
    </FileDropZone>
  );
}
