import { useCallback } from 'react';
import type { Sample } from '../types';

interface UseSampleEditingArgs {
  selectedPadId: string | null;
  getSample: (padId: string) => Sample | null | undefined;
  updateSampleProperty: (padId: string, key: string, value: unknown) => void;
  loopTrim: (getSample: () => Sample | null | undefined) => unknown;
  stopAll: () => void;
  removeSample: (padId: string) => void;
  onSampleRemoved?: () => void;
}

/**
 * Handlers for editing the currently selected sample (in-point, out-point,
 * trim, loop, remove). Pulled out of App so they can be tested in isolation
 * and so App stops growing every time we add an editing affordance.
 */
export function useSampleEditing({
  selectedPadId,
  getSample,
  updateSampleProperty,
  loopTrim,
  stopAll,
  removeSample,
  onSampleRemoved,
}: UseSampleEditingArgs) {
  const handleSetIn = useCallback(
    (time: number) => {
      if (!selectedPadId) return;
      const cur = getSample(selectedPadId);
      if (!cur) return;
      const next = Math.max(0, Math.min(time, cur.endTime - 0.01));
      updateSampleProperty(selectedPadId, 'startTime', next);
    },
    [selectedPadId, getSample, updateSampleProperty],
  );

  const handleSetOut = useCallback(
    (time: number) => {
      if (!selectedPadId) return;
      const cur = getSample(selectedPadId);
      if (!cur) return;
      const next = Math.max(cur.startTime + 0.01, Math.min(time, cur.buffer.duration));
      updateSampleProperty(selectedPadId, 'endTime', next);
    },
    [selectedPadId, getSample, updateSampleProperty],
  );

  const handleLoopStart = useCallback(() => {
    if (!selectedPadId) return null;
    stopAll();
    return loopTrim(() => getSample(selectedPadId));
  }, [selectedPadId, stopAll, loopTrim, getSample]);

  const handleTrim = useCallback(
    (start: number, end: number) => {
      if (!selectedPadId) return;
      updateSampleProperty(selectedPadId, 'startTime', start);
      updateSampleProperty(selectedPadId, 'endTime', end);
    },
    [selectedPadId, updateSampleProperty],
  );

  const handleRemove = useCallback(() => {
    if (!selectedPadId) return;
    stopAll();
    removeSample(selectedPadId);
    onSampleRemoved?.();
  }, [selectedPadId, stopAll, removeSample, onSampleRemoved]);

  return { handleSetIn, handleSetOut, handleLoopStart, handleTrim, handleRemove };
}
