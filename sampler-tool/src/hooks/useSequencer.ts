import { useEffect, useRef } from 'react';

const STEPS = 16;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.1;

export const useSequencer = ({ audioContext, samples, patterns, bpm, isPlaying, onStepChange, trigger }) => {
  const samplesRef = useRef(samples);
  const patternsRef = useRef(patterns);
  const bpmRef = useRef(bpm);
  const onStepRef = useRef(onStepChange);
  const triggerRef = useRef(trigger);

  useEffect(() => { samplesRef.current = samples; }, [samples]);
  useEffect(() => { patternsRef.current = patterns; }, [patterns]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { onStepRef.current = onStepChange; }, [onStepChange]);
  useEffect(() => { triggerRef.current = trigger; }, [trigger]);

  useEffect(() => {
    if (!isPlaying || !audioContext) return;

    let stepIndex = 0;
    let nextTime = audioContext.currentTime + 0.05;
    const pendingTimers = [];

    const scheduleStep = (step, when) => {
      Object.entries(patternsRef.current).forEach(([padId, pattern]) => {
        if (!pattern || !pattern[step]) return;
        const sample = samplesRef.current[padId];
        if (!sample || !sample.buffer) return;
        triggerRef.current(sample, when);
      });

      const delay = Math.max(0, (when - audioContext.currentTime) * 1000);
      const t = setTimeout(() => onStepRef.current(step), delay);
      pendingTimers.push(t);
    };

    const tick = setInterval(() => {
      while (nextTime < audioContext.currentTime + SCHEDULE_AHEAD) {
        scheduleStep(stepIndex, nextTime);
        const stepDur = 60 / bpmRef.current / 4;
        nextTime += stepDur;
        stepIndex = (stepIndex + 1) % STEPS;
      }
    }, LOOKAHEAD_MS);

    return () => {
      clearInterval(tick);
      pendingTimers.forEach(clearTimeout);
      onStepRef.current(-1);
    };
  }, [isPlaying, audioContext]);
};
