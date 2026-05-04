import { useRef, useState, useCallback } from 'react';

export const useAudioContext = () => {
  const audioContextRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      setIsInitialized(true);
    }
    return audioContextRef.current;
  }, []);

  const resumeContext = useCallback(async () => {
    const ctx = audioContextRef.current;
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume();
    }
  }, []);

  const playBuffer = useCallback((arrayBuffer, time = 0) => {
    const ctx = initAudioContext();
    resumeContext();

    try {
      ctx.decodeAudioData(arrayBuffer, (audioBuffer) => {
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start(time);
      });
    } catch (error) {
      console.error('Audio decode error:', error);
    }
  }, [initAudioContext, resumeContext]);

  return {
    audioContext: audioContextRef.current,
    isInitialized,
    initAudioContext,
    resumeContext,
    playBuffer,
  };
};
