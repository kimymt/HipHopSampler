import { useRef, useState, useCallback, useEffect } from 'react';

export const useAudioContext = () => {
  const audioContextRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [contextState, setContextState] = useState('uninitialized'); // 'uninitialized' | 'suspended' | 'running' | 'closed'

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const Ctor: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      audioContextRef.current = ctx;
      setIsInitialized(true);
      setContextState(ctx.state);
      ctx.addEventListener?.('statechange', () => {
        setContextState(ctx.state);
      });
    }
    return audioContextRef.current;
  }, []);

  const resumeContext = useCallback(async () => {
    const ctx = audioContextRef.current;
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (err) {
        console.warn('[audio] resume failed:', err);
      }
    }
  }, []);

  /**
   * iOS Safari (and others) suspend the AudioContext when the tab is hidden
   * or the device locks. When the tab returns we want a clean restart so a
   * pad press doesn't silently fail.
   *
   * We can attempt resume immediately, but if autoplay policy is in effect
   * the resume will fail until the next user gesture. The suspended overlay
   * (rendered by App.jsx) handles that case.
   */
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        resumeContext().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [resumeContext]);

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
    contextState,
    initAudioContext,
    resumeContext,
    playBuffer,
  };
};
