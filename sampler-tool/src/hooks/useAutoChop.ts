import { useCallback, useEffect, useRef, useState } from 'react';
import { detectOnsets, buildSlicePoints } from '../utils/onsetDetect';
import type { Sample } from '../types';

const ALL_PAD_IDS: string[] = (() => {
  const out: string[] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) out.push(`${r}-${c}`);
  return out;
})();

interface UseAutoChopArgs {
  selectedSample: Sample | null;
  selectedPadId: string | null;
  stopAll: () => void;
  updateMany: (updates: Record<string, Sample>) => void;
}

/**
 * Auto-chop hook.
 *
 * Runs onset detection on the currently selected sample, computes slice
 * boundaries, and assigns one slice per pad starting from the selected pad
 * (wrapping back to the front when we run out). Siblings share the source
 * AudioBuffer + sourceId so IndexedDB persistence stays deduplicated.
 */
export function useAutoChop({ selectedSample, selectedPadId, stopAll, updateMany }: UseAutoChopArgs) {
  const [chopMessage, setChopMessage] = useState<string | null>(null);
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setMessage = useCallback((msg: string, ms: number) => {
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current);
    }
    setChopMessage(msg);
    messageTimerRef.current = setTimeout(() => {
      setChopMessage(null);
      messageTimerRef.current = null;
    }, ms);
  }, []);

  // Cancel any pending banner clear when the hook unmounts.
  useEffect(() => {
    return () => {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    };
  }, []);

  const runAutoChop = useCallback(() => {
    if (!selectedSample || !selectedSample.buffer || !selectedPadId) return;
    stopAll();

    const buffer = selectedSample.buffer;
    const onsets = detectOnsets(buffer);
    const points = buildSlicePoints(onsets, buffer.duration);
    const sliceCount = points.length - 1;

    if (sliceCount < 2) {
      setMessage('音の境界が見つかりません。素材が短いか、音量変化が少ないかも', 4000);
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
    const updates: Record<string, Sample> = {};
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
    setMessage(`${sliceCount}スライスをパッドに割当`, 3000);
  }, [selectedSample, selectedPadId, stopAll, updateMany, setMessage]);

  return { chopMessage, runAutoChop };
}
