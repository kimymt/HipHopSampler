import { useCallback, useState } from 'react';
import {
  importReferenceFile,
  errorMessage,
  type ImportSuccess,
} from '../utils/audioImportValidation';

interface Args {
  initAudioContext: () => AudioContext | null;
}

/**
 * Reference Mode (Phase 1): import + validate + hold in memory only.
 *
 * State machine:
 *   idle → importing → ready (track loaded)
 *                    \→ error (with message; user can retry)
 *
 * Critical: the AudioBuffer lives ONLY in this hook's React state. It is
 * never written to IndexedDB or any storage. When the component unmounts or
 * the user clears the track, the buffer is dropped and GC eventually
 * reclaims the memory. This is what enforces the "no persistence" rule
 * from the dev brief — there's literally no save path.
 *
 * Phase 2 will add BPM + beat detection (returning {bpm, beats: number[]}).
 * Phase 3 will add interactive grid adjustment + lightweight save of the
 * derived numbers (NOT the audio).
 */
export type ReferenceState =
  | { status: 'idle' }
  | { status: 'importing' }
  | { status: 'ready'; track: ImportSuccess }
  | { status: 'error'; message: string };

export const useReferenceTrack = ({ initAudioContext }: Args) => {
  const [state, setState] = useState<ReferenceState>({ status: 'idle' });

  const importFile = useCallback(
    async (file: File) => {
      const ctx = initAudioContext();
      if (!ctx) {
        setState({
          status: 'error',
          message: 'オーディオが初期化されていません。一度パッドをタップしてから再試行してください。',
        });
        return;
      }
      setState({ status: 'importing' });
      const result = await importReferenceFile(file, ctx);
      // Discriminate by `ok` field — TS doesn't narrow `result.error` purely
      // from ok===false in some configs, so destructure explicitly.
      if (result.ok === true) {
        setState({ status: 'ready', track: result.data });
      } else {
        setState({ status: 'error', message: errorMessage(result.error) });
      }
    },
    [initAudioContext],
  );

  /** Clear the imported track. Drops the AudioBuffer reference so GC can
   * reclaim the (potentially 50MB+) memory. */
  const clear = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  return { state, importFile, clear };
};
