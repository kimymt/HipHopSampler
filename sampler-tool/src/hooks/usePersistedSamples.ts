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
} from '../utils/sampleStore';
import type { Sample, SampleMap, PadMetadata, RestoreState } from '../types';

const padMetadata = (s: Sample): Omit<PadMetadata, 'padId'> => ({
  sourceId: s.sourceId,
  name: s.name,
  startTime: s.startTime ?? 0,
  endTime: s.endTime ?? s.buffer?.duration ?? 0,
  loop: s.loop ?? false,
  loopStart: s.loopStart ?? 0,
  loopEnd: s.loopEnd ?? s.buffer?.duration ?? 0,
  volume: s.volume ?? 1,
  pan: s.pan ?? 0,
  chopGroup: s.chopGroup ?? undefined,
  chopIndex: s.chopIndex ?? undefined,
});

const defaultSample = (buffer: AudioBuffer, name: string, sourceId: string): Sample => ({
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

type InitAudioContext = (() => AudioContext | null) | undefined;

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
export const usePersistedSamples = (initAudioContext: InitAudioContext) => {
  const [samples, setSamples] = useState<SampleMap>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [restoreState, setRestoreState] = useState<RestoreState>({
    status: 'idle',
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
        const padEntries = (await loadAllPads()) as PadMetadata[];
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
        const sourceToPads = new Map<string, PadMetadata[]>();
        padEntries.forEach((p) => {
          if (!p.sourceId) return;
          if (!sourceToPads.has(p.sourceId)) sourceToPads.set(p.sourceId, []);
          sourceToPads.get(p.sourceId)!.push(p);
        });

        let done = 0;
        const tickProgress = (n = 1) => {
          done += n;
          setRestoreState((s) => ({ ...s, progress: Math.min(done, s.total) }));
        };

        // Decode all unique sources in parallel
        const sourceEntries = await Promise.all(
          Array.from(sourceToPads.keys()).map(async (sourceId): Promise<[string, AudioBuffer | null]> => {
            const audio = await loadAudio(sourceId);
            if (!audio?.arrayBuffer) return [sourceId, null];
            try {
              // decodeAudioData transfers the buffer — slice() to keep IDB copy intact-on-disk
              const buf = await ctx.decodeAudioData(audio.arrayBuffer.slice(0));
              return [sourceId, buf];
            } catch {
              return [sourceId, null];
            }
          }),
        );

        const sourceIdToBuffer = new Map<string, AudioBuffer | null>(sourceEntries);
        const next: SampleMap = {};
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
        const message = err instanceof Error ? err.message : 'restore failed';
        setRestoreState({ status: 'error', progress: 0, total: 0, error: message });
      }
    })();
  }, [initAudioContext]);

  const loadSample = useCallback(
    (padId: string, file: File | Blob & { name?: string; type?: string }) => {
      const ctx = initAudioContext?.();
      if (!ctx) return;
      setLoading((prev) => ({ ...prev, [padId]: true }));

      const reader = new FileReader();
      reader.onload = async (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const sourceId = generateSourceId();
        const fileName = (file as File).name ?? 'recording.webm';
        const fileType = file.type || 'audio/wav';

        try {
          // 1. Persist BEFORE decode so we don't depend on the (possibly-transferred) buffer
          await saveAudio(sourceId, arrayBuffer.slice(0), fileType);
        } catch (err) {
          console.error('[persisted-samples] saveAudio failed:', err);
          setLoading((prev) => ({ ...prev, [padId]: false }));
          return;
        }

        // 2. Decode
        ctx.decodeAudioData(
          arrayBuffer,
          async (audioBuffer) => {
            const sample = defaultSample(audioBuffer, fileName, sourceId);
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
          },
        );
      };
      reader.readAsArrayBuffer(file);
    },
    [initAudioContext],
  );

  const getSample = useCallback((padId: string): Sample | null => samples[padId] || null, [samples]);

  const updateSampleProperty = useCallback(
    <K extends keyof Sample>(padId: string, property: K, value: Sample[K]) => {
      setSamples((prev) => {
        if (!prev[padId]) return prev;
        const next = { ...prev[padId], [property]: value };
        updatePad(padId, { [property]: value }).catch(() => {});
        return { ...prev, [padId]: next };
      });
    },
    [],
  );

  const updateMany = useCallback((updates: Record<string, Partial<Sample>>) => {
    setSamples((prev) => {
      const next: SampleMap = { ...prev };
      const idbWrites: { padId: string; data: Omit<PadMetadata, 'padId'> }[] = [];
      Object.entries(updates).forEach(([padId, partial]) => {
        if (next[padId]) {
          next[padId] = { ...next[padId], ...partial } as Sample;
          idbWrites.push({ padId, data: padMetadata(next[padId] as Sample) });
        } else if ((partial as Sample).buffer) {
          // First-time write (auto chop assigns to a previously-empty pad).
          next[padId] = partial as Sample;
          idbWrites.push({ padId, data: padMetadata(partial as Sample) });
        }
      });
      if (idbWrites.length) {
        savePads(idbWrites).catch((err) => console.error('[persisted-samples] savePads failed:', err));
      }
      return next;
    });
  }, []);

  const setSample = useCallback((padId: string, sampleData: Sample) => {
    setSamples((prev) => ({ ...prev, [padId]: sampleData }));
    savePad(padId, padMetadata(sampleData)).catch((err) =>
      console.error('[persisted-samples] savePad failed:', err),
    );
  }, []);

  const removeSample = useCallback((padId: string) => {
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
