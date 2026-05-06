import { useCallback, useState } from 'react';
import {
  importReferenceFile,
  errorMessage,
  type ImportSuccess,
} from '../utils/audioImportValidation';
import { analyzeReferenceTrack, type ReferenceAnalysis } from '../utils/analyzeReference';

interface Args {
  initAudioContext: () => AudioContext | null;
}

/**
 * Reference Mode state machine.
 *
 *   idle → importing → analyzing → ready (track + analysis)
 *                                \→ error (with message; user can retry)
 *
 * Phase 1 → 2 change: a new `analyzing` step runs after decode succeeds.
 * The decoded AudioBuffer + analysis results live only in this hook's
 * React state. Per Reference Mode rules they are never written to
 * IndexedDB / localStorage / any persistence layer. Closing the panel
 * clears state, which drops the AudioBuffer reference for GC.
 *
 * Phase 3 will add `adjusted` (user-tweaked) state, with a tiny JSON
 * snapshot saved containing ONLY the BPM number + beat-position array
 * (numeric data, not audio).
 */
export type ReferenceState =
  | { status: 'idle' }
  | { status: 'importing' }
  | { status: 'analyzing'; track: ImportSuccess }
  | { status: 'ready'; track: ImportSuccess; analysis: ReferenceAnalysis }
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
      if (result.ok !== true) {
        setState({ status: 'error', message: errorMessage(result.error) });
        return;
      }

      const track = result.data;
      setState({ status: 'analyzing', track });

      try {
        const analysis = await analyzeReferenceTrack(track.buffer);
        setState({ status: 'ready', track, analysis });
      } catch (err) {
        setState({
          status: 'error',
          message: `解析中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
    [initAudioContext],
  );

  /** Clear the imported track + analysis. Drops AudioBuffer ref for GC. */
  const clear = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  return { state, importFile, clear };
};
