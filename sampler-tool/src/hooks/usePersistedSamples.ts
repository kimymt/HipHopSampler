import { useEffect, useState, useCallback, useRef } from 'react';
import {
  saveSample, loadAudio, savePads, updatePad, loadAllPads, removePad,
  generateSourceId, requestPersistentStorage, collectOrphanAudio,
} from '../utils/sampleStore';
import { withDecodedAudio, retainAudio, releaseAudio, validateAudioFileSize } from '../utils/audioSafety';
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

export const usePersistedSamples = (initAudioContext: InitAudioContext) => {
  const [samples, setSamples] = useState<SampleMap>({});
  const current = useRef<SampleMap>({});
  const owner = useRef({});
  const active = useRef(true);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const generations = useRef<Record<string, number>>({});
  const pendingImports = useRef(0);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const failedPads = useRef<string[]>([]);
  const [restoreFailures, setRestoreFailures] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [restoreState, setRestoreState] = useState<RestoreState>({ status: 'idle', progress: 0, total: 0, error: null });

  const commitState = useCallback((next: SampleMap) => {
    current.current = next;
    retainAudio(owner.current, Object.values(next).flatMap((sample) => sample ? [sample.buffer] : []));
    setSamples(next);
  }, []);
  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(task);
    queue.current = run.catch(() => {});
    return run;
  }, []);
  const report = useCallback((err: unknown, fallback: string) => {
    if (active.current) setError(err instanceof Error ? `${fallback} ${err.message}` : fallback);
  }, []);

  useEffect(() => {
    active.current = true;
    let cancelled = false;
    const memoryOwner = owner.current;
    void enqueue(async () => {
      if (cancelled) return;
      try {
        await collectOrphanAudio();
        const pads = await loadAllPads();
        if (cancelled) return;
        if (pads.length > 16) throw new Error('保存されたパッド数が上限を超えています。');
        setRestoreState({ status: 'restoring', progress: 0, total: pads.length, error: null });
        if (pads.length) void requestPersistentStorage();
        const ctx = pads.length ? initAudioContext?.() : null;
        if (pads.length && !ctx) throw new Error('オーディオを初期化できません。');
        const next: SampleMap = {};
        const buffers = new Map<string, AudioBuffer>();
        const failedSources = new Set<string>();
        const failures: string[] = [];
        for (const pad of pads) {
          if (cancelled) return;
          if (!/^[0-3]-[0-3]$/.test(pad.padId)) throw new Error('保存されたパッド情報を読み込めません。');
          let buffer = buffers.get(pad.sourceId);
          if (!buffer && !failedSources.has(pad.sourceId)) {
            try {
              const audio = await loadAudio(pad.sourceId);
              if (!audio) throw new Error('保存された音声が見つかりません。');
              await withDecodedAudio(new Blob([audio.arrayBuffer], { type: audio.mimeType }), ctx!, (decoded) => {
                buffer = decoded;
                buffers.set(pad.sourceId, decoded);
                retainAudio(memoryOwner, buffers.values());
              }, () => !cancelled);
            } catch {
              failedSources.add(pad.sourceId);
            }
          }
          if (cancelled) return;
          if (!buffer) {
            failures.push(pad.padId);
            setRestoreState((state) => ({ ...state, progress: state.progress + 1 }));
            continue;
          }
          next[pad.padId] = {
            ...defaultSample(buffer, pad.name, pad.sourceId),
            startTime: Math.max(0, Math.min(pad.startTime || 0, buffer.duration)),
            endTime: Math.max(0.01, Math.min(pad.endTime || buffer.duration, buffer.duration)),
            loop: !!pad.loop,
            loopStart: Math.max(0, Math.min(pad.loopStart || 0, buffer.duration)),
            loopEnd: Math.max(0, Math.min(pad.loopEnd || buffer.duration, buffer.duration)),
            volume: Math.max(0, Math.min(pad.volume ?? 1, 1)),
            pan: Math.max(-1, Math.min(pad.pan || 0, 1)),
            chopGroup: pad.chopGroup, chopIndex: pad.chopIndex,
          };
          setRestoreState((state) => ({ ...state, progress: state.progress + 1 }));
        }
        if (cancelled) return;
        commitState(next);
        failedPads.current = failures;
        setRestoreFailures(failures);
        setRestoreState({ status: 'ready', progress: pads.length, total: pads.length, error: null });
      } catch (err) {
        releaseAudio(memoryOwner);
        if (!cancelled) setRestoreState({ status: 'error', progress: 0, total: 0, error: err instanceof Error ? err.message : '復元に失敗しました。' });
      }
    });
    return () => { cancelled = true; active.current = false; releaseAudio(memoryOwner); };
  }, [initAudioContext, enqueue, commitState]);

  const loadSample = useCallback((padId: string, file: File | Blob & { name?: string }) => {
    try {
      validateAudioFileSize(file);
      if (!/^[0-3]-[0-3]$/.test(padId)) throw new Error('パッドを選んでください。');
      if (pendingImports.current >= 16) throw new Error('読み込み完了後に再試行してください。');
    } catch (err) { report(err, '音声を読み込めません。'); return Promise.resolve(false); }
    const generation = (generations.current[padId] || 0) + 1;
    generations.current[padId] = generation;
    const isCurrent = () => active.current && generations.current[padId] === generation;
    pendingImports.current++;
    setLoading((prev) => ({ ...prev, [padId]: true }));
    setError(null);
    return enqueue(async () => {
      try {
        if (!isCurrent()) return false;
        const ctx = initAudioContext?.();
        if (!ctx) throw new Error('オーディオを初期化できません。');
        const loaded = await withDecodedAudio(file, ctx, async (buffer, bytes) => {
          const sample = defaultSample(buffer, file.name ?? 'recording.webm', generateSourceId());
          await saveSample(padId, padMetadata(sample), bytes, file.type || 'audio/wav');
          // A delete/replacement requested during commit is already queued after us.
          if (active.current) {
            // If a newer import fails, keep the last successfully committed sample.
            commitState({ ...current.current, [padId]: sample });
            failedPads.current = failedPads.current.filter((id) => id !== padId);
            setRestoreFailures([...failedPads.current]);
          }
          return true;
        }, isCurrent);
        return !!loaded;
      } catch (err) {
        if (isCurrent()) report(err, '音声を読み込めません。別のファイルで再試行してください。');
        return false;
      } finally {
        pendingImports.current--;
        if (isCurrent()) setLoading((prev) => ({ ...prev, [padId]: false }));
      }
    });
  }, [initAudioContext, enqueue, commitState, report]);

  const getSample = useCallback((padId: string): Sample | null => current.current[padId] || null, []);

  const updateSampleProperty = useCallback(<K extends keyof Sample>(padId: string, property: K, value: Sample[K]) => {
    return enqueue(async () => {
      if (!active.current || !current.current[padId]) return;
      try {
        await updatePad(padId, { [property]: value });
        if (active.current) commitState({ ...current.current, [padId]: { ...current.current[padId]!, [property]: value } });
      } catch (err) { report(err, '変更を保存できません。再試行してください。'); }
    });
  }, [enqueue, commitState, report]);

  const updateMany = useCallback((updates: Record<string, Partial<Sample>>) => {
    // Invalidate pending decoders only for source replacements, not trim edits.
    for (const [id, partial] of Object.entries(updates)) if (partial.buffer) {
      generations.current[id] = (generations.current[id] || 0) + 1;
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
    return enqueue(async () => {
      if (!active.current) return false;
      try {
        const next = { ...current.current };
        const entries: { padId: string; data: Omit<PadMetadata, 'padId'> }[] = [];
        for (const [padId, partial] of Object.entries(updates)) {
          if (!next[padId] && !partial.buffer) continue;
          const sample = { ...next[padId], ...partial } as Sample;
          next[padId] = sample;
          entries.push({ padId, data: padMetadata(sample) });
        }
        await savePads(entries);
        if (active.current) commitState(next);
        return true;
      } catch (err) { report(err, '変更を保存できません。再試行してください。'); return false; }
    });
  }, [enqueue, commitState, report]);

  const setSample = useCallback((padId: string, sample: Sample) => updateMany({ [padId]: sample }), [updateMany]);
  const removeSample = useCallback((padId: string) => {
    generations.current[padId] = (generations.current[padId] || 0) + 1;
    setLoading((prev) => ({ ...prev, [padId]: false }));
    return enqueue(async () => {
      try {
        await removePad(padId);
        if (active.current) {
          const next = { ...current.current };
          delete next[padId];
          failedPads.current = failedPads.current.filter((id) => id !== padId);
          setRestoreFailures([...failedPads.current]);
          commitState(next);
          setError(null);
        }
        return true;
      } catch (err) { report(err, '削除できません。音声は残っています。削除をもう一度お試しください。'); return false; }
    });
  }, [enqueue, commitState, report]);

  const removeFailedSamples = useCallback(() => enqueue(async () => {
    // Read this at execution time: a successful replacement may already have removed
    // a pad from the failure list while this action was waiting behind it.
    for (const padId of [...failedPads.current]) {
      try {
        await removePad(padId);
        failedPads.current = failedPads.current.filter((id) => id !== padId);
        if (active.current) setRestoreFailures([...failedPads.current]);
      } catch (err) { report(err, '削除できません。保存データは残っています。再試行してください。'); }
    }
  }), [enqueue, report]);

  const clearError = useCallback(() => setError(null), []);
  return { samples, loading, restoreState, loadSample, getSample, updateSampleProperty, updateMany, setSample, removeSample, error, clearError, restoreFailures, removeFailedSamples };
};
