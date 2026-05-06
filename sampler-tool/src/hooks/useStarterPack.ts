import { useCallback, useState } from 'react';
import { buildStarterKit } from '../utils/synthDrums';

interface Args {
  /** Returns or initializes the AudioContext. We need its sampleRate. */
  initAudioContext: () => AudioContext | null;
  /** Existing pad-load pipeline. Same signature as user-uploaded files. */
  loadSample: (padId: string, file: File | Blob & { name?: string; type?: string }) => void;
  /** True if a pad already has a sample — we skip those to avoid clobbering. */
  hasSampleAt: (padId: string) => boolean;
}

/**
 * Phase 2C: load the synthesized starter kit into the first 8 pads.
 *
 * Behavior:
 *   - Generate 8 drum samples (kick / snare / closed hat / open hat / clap /
 *     808 / rim / perc) via Web Audio synthesis (see synthDrums.ts).
 *   - Encode each to WAV and route through the existing loadSample pipeline,
 *     so persistence + waveform display work without any new code paths.
 *   - Skip pads that already have a sample loaded — never clobber user work.
 *   - Pad layout (4×4 grid, 0-indexed `row-col`):
 *       0-0 kick     0-1 snare    0-2 chh      0-3 ohh
 *       1-0 clap     1-1 808      1-2 rim      1-3 perc
 *     This puts the kick/snare/hat row across the top — natural for someone
 *     used to a drum machine layout.
 *
 * Loading state:
 *   `loading` flips true while synthesis + WAV encoding + decode are in
 *   flight (~200-500ms total on consumer hardware). UI uses this to show a
 *   spinner / disable the trigger button.
 */
export const useStarterPack = ({ initAudioContext, loadSample, hasSampleAt }: Args) => {
  const [loading, setLoading] = useState(false);

  const PAD_ORDER = [
    '0-0', '0-1', '0-2', '0-3',
    '1-0', '1-1', '1-2', '1-3',
  ];

  const loadStarterPack = useCallback(async () => {
    if (loading) return;
    const ctx = initAudioContext();
    if (!ctx) return;
    setLoading(true);
    try {
      const samples = await buildStarterKit(ctx.sampleRate);
      samples.forEach((sample, i) => {
        const padId = PAD_ORDER[i];
        if (!padId) return;
        if (hasSampleAt(padId)) return; // never clobber user work
        // Wrap Blob as File-shaped object so loadSample's reader picks up
        // the name. Real File would also work; this is lighter.
        const fileLike = new File([sample.blob], sample.name, { type: 'audio/wav' });
        loadSample(padId, fileLike);
      });
    } finally {
      setLoading(false);
    }
    // PAD_ORDER is module-scope-stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initAudioContext, loadSample, hasSampleAt, loading]);

  return { loadStarterPack, loading };
};
