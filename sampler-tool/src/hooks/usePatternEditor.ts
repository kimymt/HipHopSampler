import { useCallback } from 'react';
import { usePersistedState } from './usePersistence';

interface UsePatternEditorArgs {
  selectedPadId: string | null;
  isRecording: boolean;
  currentStep: number;
}

/**
 * Owns the 16-step pattern map (padId → boolean[16]) plus the three editing
 * paths: live recording (tap during playback), manual toggle (sequencer cell
 * click), and clear (current pad's pattern).
 */
export function usePatternEditor({ selectedPadId, isRecording, currentStep }: UsePatternEditorArgs) {
  const [patterns, setPatterns] = usePersistedState('patterns', {});

  const recordStep = useCallback(
    (padId: string) => {
      if (!isRecording || currentStep < 0) return;
      setPatterns((prev: Record<string, boolean[]>) => {
        const cur = prev[padId] || new Array(16).fill(false);
        const next = [...cur];
        next[currentStep] = true;
        return { ...prev, [padId]: next };
      });
    },
    [isRecording, currentStep, setPatterns],
  );

  const toggleStep = useCallback(
    (stepIdx: number) => {
      if (!selectedPadId) return;
      setPatterns((prev: Record<string, boolean[]>) => {
        const cur = prev[selectedPadId] || new Array(16).fill(false);
        const next = [...cur];
        next[stepIdx] = !next[stepIdx];
        return { ...prev, [selectedPadId]: next };
      });
    },
    [selectedPadId, setPatterns],
  );

  const clearPattern = useCallback(() => {
    if (!selectedPadId) return;
    setPatterns((prev: Record<string, boolean[]>) => {
      const next = { ...prev };
      delete next[selectedPadId];
      return next;
    });
  }, [selectedPadId, setPatterns]);

  const selectedPattern = selectedPadId ? patterns[selectedPadId] : null;

  return { patterns, selectedPattern, recordStep, toggleStep, clearPattern };
}
