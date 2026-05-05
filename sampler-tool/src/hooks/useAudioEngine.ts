import { useCallback, useRef } from 'react';

/**
 * Tracks every BufferSource we schedule so we can stop them all on demand
 * (Stop button, sample remove, page hide).
 *
 * Web Audio's BufferSource is one-shot: calling start() schedules it on the
 * audio clock. Without an explicit stop() it plays through, even after our
 * sequencer scheduler is torn down.
 */
export const useAudioEngine = (initAudioContext) => {
  const activeRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const trigger = useCallback((sample, when = 0) => {
    const ctx = initAudioContext();
    if (!ctx || !sample || !sample.buffer) return null;

    const source = ctx.createBufferSource();
    source.buffer = sample.buffer;
    source.loop = sample.loop || false;

    const gain = ctx.createGain();
    gain.gain.value = sample.volume ?? 1;
    const panner = ctx.createStereoPanner();
    panner.pan.value = sample.pan ?? 0;

    source.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    const offset = sample.startTime ?? 0;
    const end = sample.endTime ?? sample.buffer.duration;
    const duration = Math.max(0.01, end - offset);

    const startAt = when || ctx.currentTime;
    source.start(startAt, offset, duration);

    activeRef.current.add(source);
    source.onended = () => activeRef.current.delete(source);

    return source;
  }, [initAudioContext]);

  /**
   * Loop the trim region continuously. Returns a controller with
   *  - getPosition(): current playhead time within the buffer (seconds)
   *  - stop(): stops the loop
   * The trim region is read live from a getter, so dragging IN/OUT while
   * looping updates the loop bounds on the next iteration.
   */
  const loopTrim = useCallback((getSample) => {
    const ctx = initAudioContext();
    const sample = getSample();
    if (!ctx || !sample || !sample.buffer) return null;

    const source = ctx.createBufferSource();
    source.buffer = sample.buffer;
    source.loop = true;
    source.loopStart = sample.startTime ?? 0;
    source.loopEnd = sample.endTime ?? sample.buffer.duration;

    const gain = ctx.createGain();
    gain.gain.value = sample.volume ?? 1;
    const panner = ctx.createStereoPanner();
    panner.pan.value = sample.pan ?? 0;

    source.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    const startedAt = ctx.currentTime;
    const initialOffset = source.loopStart;
    source.start(0, initialOffset);
    activeRef.current.add(source);

    let stopped = false;

    const watcher = setInterval(() => {
      const cur = getSample();
      if (!cur || !cur.buffer) return;
      const newStart = cur.startTime ?? 0;
      const newEnd = cur.endTime ?? cur.buffer.duration;
      if (Math.abs(source.loopStart - newStart) > 0.001) source.loopStart = newStart;
      if (Math.abs(source.loopEnd - newEnd) > 0.001) source.loopEnd = newEnd;
      if (Math.abs(source.gainNodeValue ?? gain.gain.value - (cur.volume ?? 1)) > 0.001) {
        gain.gain.value = cur.volume ?? 1;
      }
      if (Math.abs(panner.pan.value - (cur.pan ?? 0)) > 0.001) {
        panner.pan.value = cur.pan ?? 0;
      }
    }, 60);

    const getPosition = () => {
      if (stopped) return null;
      const cur = getSample();
      if (!cur || !cur.buffer) return null;
      const loopStart = cur.startTime ?? 0;
      const loopEnd = cur.endTime ?? cur.buffer.duration;
      const loopLen = Math.max(0.001, loopEnd - loopStart);
      const elapsed = ctx.currentTime - startedAt;
      // First pass: from initialOffset to loopEnd
      const firstPassLen = Math.max(0, source.buffer.duration - initialOffset);
      if (elapsed < firstPassLen && initialOffset >= loopStart && initialOffset <= loopEnd) {
        return initialOffset + elapsed;
      }
      // Subsequent passes wrap within [loopStart, loopEnd]
      const afterFirst = elapsed - Math.min(firstPassLen, loopEnd - initialOffset);
      return loopStart + (afterFirst % loopLen);
    };

    const stop = () => {
      if (stopped) return;
      stopped = true;
      clearInterval(watcher);
      try { source.stop(); } catch {}
      activeRef.current.delete(source);
    };

    return { getPosition, stop };
  }, [initAudioContext]);

  const stopAll = useCallback(() => {
    activeRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // already ended
      }
    });
    activeRef.current.clear();
  }, []);

  return { trigger, loopTrim, stopAll };
};
