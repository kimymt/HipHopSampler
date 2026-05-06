/**
 * Reference Mode analyzer (Phase 2).
 *
 * Pipeline: AudioBuffer → onsets (existing detectOnsets) → BPM estimate
 * (bpmEstimate) → beat grid (buildBeatGrid).
 *
 * Why two outputs (onsets + beat grid):
 *   - onsets are real percussive events found in the track. Useful for
 *     showing the user where actual hits occur (visual learning).
 *   - beat grid is a regular metronome-style ruler at the estimated BPM.
 *     Useful for showing the user the underlying tempo (training their
 *     ear to count). The grid won't always align perfectly with onsets —
 *     the gap is itself instructive (syncopation, swing).
 *
 * Phase 3 will add manual offset adjustment so the user can lock the grid
 * to the actual downbeat. Phase 2 anchors the grid at t=0.
 */

import { detectOnsets } from './onsetDetect';
import { estimateBpm, buildBeatGrid, type BpmEstimate } from './bpmEstimate';

export interface ReferenceAnalysis {
  /** Real onsets (percussive hits) in seconds. */
  onsets: number[];
  /** Estimated tempo + confidence. */
  bpm: BpmEstimate;
  /** Beat grid at the estimated BPM, anchored at t=0. Empty if BPM unknown. */
  beatGrid: number[];
}

/**
 * Run the analysis pipeline. The work is synchronous and CPU-bound — for
 * a 3-minute track on a typical laptop, ~50-200ms total. We expose this
 * as `Promise<ReferenceAnalysis>` so callers can `await` and update UI
 * after the microtask, but no actual async I/O happens.
 */
export const analyzeReferenceTrack = async (
  buffer: AudioBuffer,
): Promise<ReferenceAnalysis> => {
  // Yield to the event loop once so the "analyzing…" UI gets a paint.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  // Existing detectOnsets is tuned for short loops (32-onset cap). For a
  // full track we lift the cap and slightly relax min spacing so we don't
  // miss double-time hi-hats. Window/hop sizes stay the same — they are
  // appropriate for hip-hop transients regardless of total length.
  const onsets = detectOnsets(buffer, {
    maxOnsets: 5000,
    minSpacing: 0.06, // 60ms — fits 16th notes at ~250 BPM
    relativeThreshold: 0.20, // slightly more permissive for full songs
  });

  const bpm = estimateBpm(onsets);
  const beatGrid =
    bpm.bpm > 0 ? buildBeatGrid(bpm.bpm, buffer.duration) : [];

  return { onsets, bpm, beatGrid };
};
