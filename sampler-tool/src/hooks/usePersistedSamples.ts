import { useEffect, useState, useCallback, useRef } from 'react';
import {
  saveAudio,
  loadAudio,
  savePad,
  savePads,
  updatePad,
  loadAllPads,
  removePad,
  generateSourceId,
  requestPersistentStorage,
  estimateQuota,
} from '../utils/sampleStore';

const padMetadata = (s) => ({
  sourceId: s.sourceId,
  name: s.name,
  startTime: s.startTime ?? 0,
  endTime: s.endTime ?? s.buffer?.duration ?? 0,
  loop: s.loop ?? false,
  loopStart: s.loopStart ?? 0,
  loopEnd: s.loopEnd ?? s.buffer?.duration ?? 0,
  volume: s.volume ?? 1,
  pan: s.pan ?? 0,
  chopGroup: s.chopGroup ?? null,
  chopIndex: s.chopIndex ?? null,
});

const defaultSample = (buffer, name, sourceId) => ({
  buffer,
  name,
  sourceId,
  startTime: 0,
  endTime: buffer.duration,
  loop: false,
  loopStart: 0,
  loopEnd: buffer.duration,
  volume: 1,
  pan: 0,
});

/**
 * Persistence-aware sample state.
 *
 * Lifecycle:
 *  1. mount → request persistent storage → load all pads → decode each unique source
 *     in parallel (with progress) → restore samples state
 *  2. loadSample → save bytes to IDB BEFORE decode (decode may transfer the buffer)
 *  3. setSample / updateMany → mirror to IDB
 *  4. removeSample → delete pad + GC orphan audio
 */
export const usePersistedSamples = (initAudioContext) => {
  const [samples, setSamples] = useState({});
  const [loading, setLoading] = useState({});
  const [restoreState, setRestoreState] = useState({
    status: 'idle', // 'idle' | 'restoring' | 'ready' | 'error'
    progress: 0,
    total: 0,
    error: null,
  });
  const hasRestoredRef = useRef(false);

  // Initial restore on mount.
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    (async () => {
      try {
        const padEntries = await loadAllPads();
        if (!padEntries.length) {
          setRestoreState({ status: 'ready', progress: 0, total: 0, error: null });
          return;
        }

        setRestoreState({ status: 'restoring', progress: 0, total: padEntries.length, error: null });
        // Best-effort: keep storage alive on iOS / Firefox under pressure
        requestPersistentStorage().catch(() => {});

        const ctx = initAudioContext?.();
        if (!ctx) {
          setRestoreState({ status: 'error', progress: 0, total: padEntries.length, error: 'AudioContext unavailable' });
          return;
        }

        // Group pads by sourceId so we decode each unique buffer once.
        const sourceToPads = new Map();
        padEntries.forEach((p) => {
          if (!p.sourceId) return;
          if (!sourceToPads.has(p.sourceId)) sourceToPads.set(p.sourceId, []);
          sourceToPads.get(p.sourceId).push(p);
        });

        let done = 0;
        const tickProgress = (n = 1) => {
          done += n;
          setRestoreState((s) => ({ ...s, progress: Math.min(done, s.total) }));
        };

        // Decode all unique sources in parallel
        const sourceEntries = await Promise.all(
          Array.from(sourceToPads.keys()).map(async (sourceId) => {
            const audio = await loadAudio(sourceId);
            if (!audio?.arrayBuffer) return [sourceId, null];
            try {
              // decodeAudioData transfers the buffer — slice() to keep IDB copy intact-on-disk
              const buf = await ctx.decodeAudioData(audio.arrayBuffer.slice(0));
              return [sourceId, buf];
            } catch {
              return [sourceId, null];
            }
          })
        );

        const sourceIdToBuffer = new Map(sourceEntries);
        const next = {};
        padEntries.forEach((p) => {
          const buffer = sourceIdToBuffer.get(p.sourceId);
          if (!buffer) {
            tickProgress();
            return;
          }
          next[p.padId] = {
            buffer,
            sourceId: p.sourceId,
            name: p.name,
            startTime: Math.max(0, Math.min(p.startTime ?? 0, buffer.duration)),
            endTime: Math.max(0.01, Math.min(p.endTime ?? buffer.duration, buffer.duration)),
            loop: !!p.loop,
            loopStart: p.loopStart ?? 0,
            loopEnd: p.loopEnd ?? buffer.duration,
            volume: p.volume ?? 1,
            pan: p.pan ?? 0,
            chopGroup: p.chopGroup || undefined,
            chopIndex: typeof p.chopIndex === 'number' ? p.chopIndex : undefined,
          };
          tickProgress();
        });

        setSamples(next);
        setRestoreState({ status: 'ready', progress: padEntries.length, total: padEntries.length, error: null });
      } catch (err) {
        console.error('[persisted-samples] restore failed:', err);
        setRestoreState({ status: 'error', progress: 0, total: 0, error: err?.message || 'restore failed' });
      }
    })();
  }, [initAudioContext]);

  const loadSample = useCallback((padId, file) => {
    const ctx = initAudioContext?.();
    if (!ctx) return;
    setLoading((prev) => ({ ...prev, [padId]: true }));

    const reader = new FileReader();
    reader.onload = async (e) => {
      const arrayBuffer = e.target.result;
      const sourceId = generateSourceId();

      try {
        // 1. Persist BEFORE decode so we don't depend on the (possibly-transferred) buffer
        await saveAudio(sourceId, arrayBuffer.slice(0), file.type || 'audio/wav');
      } catch (err) {
        console.error('[persisted-samples] saveAudio failed:', err);
        setLoading((prev) => ({ ...prev, [padId]: false }));
        return;
      }

      // 2. Decode
      ctx.decodeAudioData(
        arrayBuffer,
        async (audioBuffer) => {
          const sample = defaultSample(audioBuffer, file.name, sourceId);
          setSamples((prev) => ({ ...prev, [padId]: sample }));
          setLoading((prev) => ({ ...prev, [padId]: false }));
          // 3. Persist pad metadata
          try {
            await savePad(padId, padMetadata(sample));
          } catch (err) {
            console.error('[persisted-samples] savePad failed:', err);
          }
        },
        (err) => {
          console.error('[persisted-samples] decode failed:', err);
          setLoading((prev) => ({ ...prev, [padId]: false }));
        }
      );
    };
    reader.readAsArrayBuffer(file);
  }, [initAudioContext]);

  const getSample = useCallback((padId) => samples[padId] || null, [samples]);

  const updateSampleProperty = useCallback((padId, property, value) => {
    setSamples((prev) => {
      if (!prev[padId]) return prev;
      const next = { ...prev[padId], [property]: value };
      updatePad(padId, { [property]: value }).catch(() => {});
      return { ...prev, [padId]: next };
    });
  }, []);

  const updateMany = useCallback((updates) => {
    setSamples((prev) => {
      const next = { ...prev };
      const idbWrites = [];
      Object.entries(updates).forEach(([padId, partial]) => {
        if (next[padId]) {
          next[padId] = { ...next[padId], ...partial };
          idbWrites.push({ padId, data: padMetadata(next[padId]) });
        } else {
          next[padId] = partial;
          idbWrites.push({ padId, data: padMetadata(partial) });
        }
      });
      if (idbWrites.length) {
        savePads(idbWrites).catch((err) => console.error('[persisted-samples] savePads failed:', err));
      }
      return next;
    });
  }, []);

  const setSample = useCallback((padId, sampleData) => {
    setSamples((prev) => ({ ...prev, [padId]: sampleData }));
    savePad(padId, padMetadata(sampleData)).catch((err) =>
      console.error('[persisted-samples] savePad failed:', err)
    );
  }, []);

  const removeSample = useCallback((padId) => {
    setSamples((prev) => {
      const next = { ...prev };
      delete next[padId];
      return next;
    });
    removePad(padId).catch((err) => console.error('[persisted-samples] removePad failed:', err));
  }, []);

  return {
    samples,
    loading,
    restoreState,
    loadSample,
    getSample,
    updateSampleProperty,
    updateMany,
    setSample,
    removeSample,
  };
};
