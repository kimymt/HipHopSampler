/**
 * Detect onsets (transients / drum hits) in an AudioBuffer.
 *
 * Approach: short-time RMS → spectral-flux-like positive derivative →
 * peak picking with adaptive threshold and minimum spacing.
 *
 * Tuned for Hip Hop drum loops & vocal phrases. Not meant to be perfect —
 * the user can drag boundaries to fix anything we miss.
 */
interface OnsetOptions {
  windowSize?: number;       // analysis window in seconds
  hopSize?: number;          // hop in seconds (50% overlap default)
  minSpacing?: number;       // minimum seconds between detected hits
  relativeThreshold?: number; // 0..1 — peaks above this fraction of max flux
  maxOnsets?: number;        // hard cap on count
}

// Minimal subset of the AudioBuffer interface that the detector needs.
// Lets tests pass plain objects instead of constructing real buffers.
interface AudioBufferLike {
  getChannelData(ch: number): Float32Array;
  sampleRate: number;
  duration: number;
  length: number;
  numberOfChannels: number;
}

export const detectOnsets = (audioBuffer: AudioBufferLike, options: OnsetOptions = {}): number[] => {
  const {
    windowSize = 0.023,       // ~23ms window
    hopSize = 0.011,          // ~11ms hop (50% overlap)
    minSpacing = 0.08,        // 80ms minimum between hits
    relativeThreshold = 0.30, // peaks > 30% of max flux
    maxOnsets = 32,           // safety cap
  } = options;

  const data = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const winSamples = Math.max(2, Math.floor(windowSize * sampleRate));
  const hopSamples = Math.max(1, Math.floor(hopSize * sampleRate));

  // 1. Short-time RMS energy
  const rms = [];
  for (let i = 0; i + winSamples < data.length; i += hopSamples) {
    let sum = 0;
    for (let j = 0; j < winSamples; j++) {
      const v = data[i + j];
      sum += v * v;
    }
    rms.push(Math.sqrt(sum / winSamples));
  }

  if (rms.length < 4) return [];

  // 2. Positive derivative (proxy for spectral flux on energy)
  const flux = [0];
  for (let i = 1; i < rms.length; i++) {
    flux.push(Math.max(0, rms[i] - rms[i - 1]));
  }

  // 3. Adaptive threshold (relative to max)
  let maxFlux = 0;
  for (let i = 0; i < flux.length; i++) {
    if (flux[i] > maxFlux) maxFlux = flux[i];
  }
  if (maxFlux <= 1e-6) return []; // dead silence
  const threshold = maxFlux * relativeThreshold;

  // 4. Peak picking with min spacing
  const minHopGap = Math.max(1, Math.floor(minSpacing / hopSize));
  const onsets = [];
  let lastPeakHop = -minHopGap;

  for (let i = 1; i < flux.length - 1; i++) {
    const isLocalMax = flux[i] > flux[i - 1] && flux[i] >= flux[i + 1];
    if (flux[i] >= threshold && isLocalMax && i - lastPeakHop >= minHopGap) {
      onsets.push(i * hopSize);
      lastPeakHop = i;
      if (onsets.length >= maxOnsets) break;
    }
  }

  return onsets;
};

/**
 * Build slice points from onsets. Always starts at 0 (or near 0 if first
 * onset is right at the start) and ends at buffer.duration.
 *
 * Returns an array of N+1 boundaries that define N slices.
 */
export const buildSlicePoints = (onsets: number[], totalDuration: number): number[] => {
  const points = [...onsets];
  // If the first onset is way past the start, prepend 0 so we keep the head
  if (points.length === 0 || points[0] > 0.04) {
    points.unshift(0);
  } else {
    points[0] = 0; // snap first onset to 0 to avoid a tiny head slice
  }
  if (points[points.length - 1] < totalDuration - 0.04) {
    points.push(totalDuration);
  } else {
    points[points.length - 1] = totalDuration;
  }
  return points;
};
