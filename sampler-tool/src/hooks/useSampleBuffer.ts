import { useState, useCallback } from 'react';

const defaultSample = (buffer, name) => ({
  buffer,
  name,
  startTime: 0,
  endTime: buffer.duration,
  loop: false,
  loopStart: 0,
  loopEnd: buffer.duration,
  volume: 1,
  pan: 0,
});

export const useSampleBuffer = (initAudioContext) => {
  const [samples, setSamples] = useState({});
  const [loading, setLoading] = useState({});

  const loadSample = useCallback((padId, file) => {
    const ctx = typeof initAudioContext === 'function' ? initAudioContext() : initAudioContext;
    if (!ctx) return;
    setLoading((prev) => ({ ...prev, [padId]: true }));

    const reader = new FileReader();
    reader.onload = (e) => {
      ctx.decodeAudioData(
        e.target.result,
        (audioBuffer) => {
          setSamples((prev) => ({
            ...prev,
            [padId]: defaultSample(audioBuffer, file.name),
          }));
          setLoading((prev) => ({ ...prev, [padId]: false }));
        },
        (err) => {
          console.error('Audio decode error:', err);
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
      return {
        ...prev,
        [padId]: { ...prev[padId], [property]: value },
      };
    });
  }, []);

  const removeSample = useCallback((padId) => {
    setSamples((prev) => {
      const next = { ...prev };
      delete next[padId];
      return next;
    });
  }, []);

  /**
   * Set a sample on a pad in one shot. Used for atomic operations like
   * AUTO CHOP that need to drop multiple slices into multiple pads
   * simultaneously, all sharing the same source AudioBuffer.
   */
  const setSample = useCallback((padId, sampleData) => {
    setSamples((prev) => ({ ...prev, [padId]: sampleData }));
  }, []);

  /**
   * Atomic multi-pad write. Required for AUTO CHOP because dragging a
   * boundary updates two siblings at once and we don't want React to
   * settle on a stale intermediate state.
   */
  const updateMany = useCallback((updates: Record<string, any>) => {
    setSamples((prev: any) => {
      const next: any = { ...prev };
      Object.entries(updates).forEach(([padId, partial]: [string, any]) => {
        if (next[padId]) {
          next[padId] = { ...next[padId], ...partial };
        } else {
          next[padId] = partial;
        }
      });
      return next;
    });
  }, []);

  return {
    samples,
    loading,
    loadSample,
    getSample,
    updateSampleProperty,
    updateMany,
    setSample,
    removeSample,
  };
};
