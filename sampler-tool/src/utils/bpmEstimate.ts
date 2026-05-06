/**
 * BPM estimation from onset times.
 *
 * Approach: inter-onset-interval (IOI) histogram. For every pair of nearby
 * onsets, compute the implied tempo and bucket it. The peak bucket is the
 * winning BPM. Hip-hop sits firmly in 60-180 BPM and the implied-tempo
 * trick works well there because beat IOIs (quarter notes) plus half/double
 * folds (eighth, half-time) accumulate on the same bucket.
 *
 * Why not autocorrelation: more robust to noisy onsets, but ~10x more code
 * and the IOI histogram approach is sufficient for the "give the user a
 * BPM number to learn from" UX. If accuracy proves insufficient at Phase
 * 3 testing, swap this module for a more sophisticated implementation
 * (interface stays {bpm, confidence}).
 *
 * Usable BPM range: 60-180 (covers hip-hop / boom bap / trap / drill /
 * footwork without spurious half-time or double-time matches).
 */

const MIN_BPM = 60;
const MAX_BPM = 180;
/** Bucket resolution. 0.5 BPM is finer than musicians distinguish; coarser
 * loses peak sharpness on subtle tempo. */
const BUCKET_SIZE = 0.5;
const NUM_BUCKETS = Math.round((MAX_BPM - MIN_BPM) / BUCKET_SIZE) + 1;

export interface BpmEstimate {
  /** Estimated BPM, rounded to integer. 0 if no estimate possible. */
  bpm: number;
  /** Peak vote share, 0..1. Higher = more onsets agree on this tempo. */
  confidence: number;
}

const ZERO: BpmEstimate = { bpm: 0, confidence: 0 };

/**
 * Estimate BPM from onset timestamps (seconds, sorted ascending).
 * Returns {bpm: 0, confidence: 0} when there aren't enough onsets to
 * form a usable distribution.
 */
export const estimateBpm = (onsets: readonly number[]): BpmEstimate => {
  if (onsets.length < 4) return ZERO;

  // 1. Build IOI histogram. For each pair (i, j) with j > i within a 4-sec
  //    window (~80 BPM minimum spacing of 4 quarter notes), compute the
  //    implied BPM and add a vote. Folding: any candidate < MIN_BPM is
  //    doubled, any > MAX_BPM is halved, until in range.
  const buckets = new Float32Array(NUM_BUCKETS);
  let totalVotes = 0;
  const MAX_IOI_SEC = 4.0;

  for (let i = 0; i < onsets.length; i++) {
    for (let j = i + 1; j < onsets.length; j++) {
      const ioi = onsets[j] - onsets[i];
      if (ioi <= 0.05) continue; // duplicates / cluster artefacts
      if (ioi > MAX_IOI_SEC) break; // sorted, no more pairs to consider

      // Implied tempo for this IOI (treated as one beat). Fold to range.
      let candidate = 60 / ioi;
      let weight = 1;
      while (candidate < MIN_BPM) {
        candidate *= 2;
        weight *= 0.5; // half-vote for harmonic folds
      }
      while (candidate > MAX_BPM) {
        candidate /= 2;
        weight *= 0.5;
      }
      if (candidate < MIN_BPM || candidate > MAX_BPM) continue;

      const bucketIdx = Math.round((candidate - MIN_BPM) / BUCKET_SIZE);
      if (bucketIdx >= 0 && bucketIdx < NUM_BUCKETS) {
        buckets[bucketIdx] += weight;
        totalVotes += weight;
      }
    }
  }

  if (totalVotes < 4) return ZERO;

  // 2. Smooth with a tiny triangular kernel. Without smoothing, two
  //    adjacent buckets with similar votes can flip the winner on noise.
  const smoothed = new Float32Array(NUM_BUCKETS);
  for (let i = 0; i < NUM_BUCKETS; i++) {
    let s = buckets[i] * 2;
    if (i > 0) s += buckets[i - 1];
    if (i < NUM_BUCKETS - 1) s += buckets[i + 1];
    smoothed[i] = s / 4;
  }

  // 3. Apply preferred-tempo curve. Pure histogram peak-picking suffers
  //    from half-time bias: a 120 BPM track produces big votes at both
  //    120 and 60 (every-other-beat reading), and 60 often wins on
  //    pair count alone. Music-perception literature (Parncutt 1994,
  //    Toiviainen-Snyder 2003) shows humans prefer tempos near
  //    100-120 BPM; weighting buckets by a Gaussian centered there
  //    reproduces the perceptual choice without over-fitting.
  const PREFERRED_BPM = 110;
  const PREFERRED_SIGMA = 50;
  const weighted = new Float32Array(NUM_BUCKETS);
  for (let i = 0; i < NUM_BUCKETS; i++) {
    const candidateBpm = MIN_BPM + i * BUCKET_SIZE;
    const z = (candidateBpm - PREFERRED_BPM) / PREFERRED_SIGMA;
    weighted[i] = smoothed[i] * Math.exp(-z * z);
  }

  // 4. Peak pick on the weighted distribution.
  let peakIdx = 0;
  let peakVal = 0;
  for (let i = 0; i < NUM_BUCKETS; i++) {
    if (weighted[i] > peakVal) {
      peakVal = weighted[i];
      peakIdx = i;
    }
  }

  if (peakVal <= 0) return ZERO;

  const bpm = Math.round(MIN_BPM + peakIdx * BUCKET_SIZE);
  // Confidence: peak share of total weighted mass. ~0.05-0.1 is typical
  // for a clear tempo; below ~0.02 indicates noisy / non-percussive input.
  const totalWeighted = weighted.reduce((a, b) => a + b, 0);
  const confidence = totalWeighted > 0 ? peakVal / totalWeighted : 0;

  return { bpm, confidence };
};

/**
 * Generate a beat grid given a BPM, duration, and starting offset.
 *
 * Phase 2 anchored the grid at t=0. Phase 3a adds the offset parameter so
 * the user can drag the grid to match the actual downbeat (most tracks
 * start with an intro and the first real beat lands somewhere > 0).
 *
 * Negative offsets are allowed and clamped: only beats >= 0 and < duration
 * are emitted, so the grid still fills the whole waveform regardless of
 * where the user dragged it.
 */
export const buildBeatGrid = (
  bpm: number,
  durationSec: number,
  offsetSec = 0,
): number[] => {
  if (bpm <= 0 || durationSec <= 0) return [];
  const beatInterval = 60 / bpm;
  const grid: number[] = [];
  // Walk backwards from offset to populate any beats before the offset that
  // still fall in [0, durationSec). Then walk forwards from offset.
  let t = offsetSec;
  while (t >= 0) {
    if (t < durationSec) grid.unshift(t);
    t -= beatInterval;
  }
  t = offsetSec + beatInterval;
  while (t < durationSec) {
    if (t >= 0) grid.push(t);
    t += beatInterval;
  }
  return grid;
};
