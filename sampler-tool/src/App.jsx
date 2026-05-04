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
import { useAudioContext } from './hooks/useAudioContext';
import { usePWA } from './hooks/usePWA';
import { useAudioEngine } from './hooks/useAudioEngine';
import { usePersistedSamples } from './hooks/usePersistedSamples';
import { useSequencer } from './hooks/useSequencer';
import { usePersistedState } from './hooks/usePersistence';
import { useStorageQuota } from './hooks/useStorageQuota';
import { detectOnsets, buildSlicePoints } from './utils/onsetDetect';
import { clearAll } from './utils/sampleStore';
import './App.css';

const TOUR_FLAG = 'sampler.tour.completed';

const ALL_PAD_IDS = (() => {
  const out = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) out.push(`${r}-${c}`);
  return out;
})();

export default function App() {
  const { audioContext, initAudioContext } = useAudioContext();
  const { trigger, loopTrim, stopAll } = useAudioEngine(initAudioContext);
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
  const [bpm, setBpm] = usePersistedState('bpm', 90);
  const [patterns, setPatterns] = usePersistedState('patterns', {});
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [tourOpen, setTourOpen] = useState(false);
  const [chopMessage, setChopMessage] = useState(null);
  const pwa = usePWA();

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
    }
  };

  const handlePadClick = (padId) => {
    const sample = getSample(padId);
    if (sample && sample.buffer) {
      trigger(sample);
    }
    setSelectedPadId(padId);

    if (isRecording && currentStep >= 0) {
      setPatterns((prev) => {
        const cur = prev[padId] || new Array(16).fill(false);
        const next = [...cur];
        next[currentStep] = true;
        return { ...prev, [padId]: next };
      });
    }
  };

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

  // ── AUTO CHOP ─────────────────────────────────────────────
  const selectedSample = selectedPadId ? getSample(selectedPadId) : null;

  const handleAutoChop = () => {
    if (!selectedSample || !selectedSample.buffer) return;
    stopAll();

    const buffer = selectedSample.buffer;
    const onsets = detectOnsets(buffer);
    const points = buildSlicePoints(onsets, buffer.duration);
    const sliceCount = points.length - 1;

    if (sliceCount < 2) {
      setChopMessage('音の境界が見つかりません。素材が短いか、音量変化が少ないかも');
      setTimeout(() => setChopMessage(null), 4000);
      return;
    }

    // Targets: start at the selected pad, walk forward, fill empty pads first.
    // If we run out of empty pads, overwrite from the start of the chop range.
    const startIdx = ALL_PAD_IDS.indexOf(selectedPadId);
    const ordered = [
      ...ALL_PAD_IDS.slice(startIdx),
      ...ALL_PAD_IDS.slice(0, startIdx),
    ];
    const targets = ordered.slice(0, sliceCount);

    const groupId = `chop-${Date.now().toString(36)}`;
    const baseName = selectedSample.name;
    // Siblings share the source bytes — propagate sourceId so restore works.
    const sourceId = selectedSample.sourceId;
    const updates = {};
    targets.forEach((padId, idx) => {
      updates[padId] = {
        buffer,
        sourceId,
        name: idx === 0 ? baseName : `${baseName} #${idx + 1}`,
        startTime: points[idx],
        endTime: points[idx + 1],
        loop: false,
        loopStart: 0,
        loopEnd: buffer.duration,
        volume: 1,
        pan: 0,
        chopGroup: groupId,
        chopIndex: idx,
      };
    });
    updateMany(updates);
    setChopMessage(`${sliceCount}スライスをパッドに割当`);
    setTimeout(() => setChopMessage(null), 3000);
  };

  // Compute chop boundaries (vertical lines on waveform) for the current pad's group
  const chopBoundaries = useMemo(() => {
    if (!selectedSample || !selectedSample.chopGroup) return null;
    const siblings = Object.entries(samples)
      .filter(([_, s]) => s?.chopGroup === selectedSample.chopGroup)
      .sort((a, b) => (a[1].chopIndex ?? 0) - (b[1].chopIndex ?? 0));
    if (siblings.length === 0) return null;
    const boundaries = [siblings[0][1].startTime];
    siblings.forEach(([_, s]) => boundaries.push(s.endTime));
    // Map index → padIds it touches
    const padIdsAt = boundaries.map((_, i) => ({
      // boundary i sits between sibling i-1 (out) and sibling i (in)
      prev: i > 0 ? siblings[i - 1][0] : null,
      next: i < siblings.length ? siblings[i][0] : null,
    }));
    return { times: boundaries, padIdsAt, currentIndex: selectedSample.chopIndex ?? 0 };
  }, [selectedSample, samples]);

  const handleBoundaryDrag = (boundaryIdx, newTime) => {
    if (!chopBoundaries) return;
    const { padIdsAt, times } = chopBoundaries;
    const at = padIdsAt[boundaryIdx];
    // Clamp within neighbors so slices don't cross
    const lo = boundaryIdx > 0 ? times[boundaryIdx - 1] + 0.01 : 0;
    const hi = boundaryIdx < times.length - 1 ? times[boundaryIdx + 1] - 0.01 : selectedSample.buffer.duration;
    const t = Math.max(lo, Math.min(hi, newTime));

    const updates = {};
    if (at.prev) updates[at.prev] = { endTime: t };
    if (at.next) updates[at.next] = { startTime: t };
    if (Object.keys(updates).length) updateMany(updates);
  };

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
  const loadedCount = Object.values(samples).filter((s) => s && s.buffer).length;

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
              />
              <div className="hint-text">
                Drag &amp; drop audio files (WAV / MP3) onto a selected pad
              </div>
            </section>

            <section className="workspace-right">
              <div className="section-label">
                <span className="dot"></span>
                SAMPLE
              </div>
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
                }}
                onAutoChop={handleAutoChop}
                chopMessage={chopMessage}
              />
            </section>
          </div>

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
        onApply={pwa.applyUpdate}
        onDismissUpdate={pwa.dismissUpdate}
        onDismissOffline={pwa.dismissOfflineReady}
      />
    </FileDropZone>
  );
}
