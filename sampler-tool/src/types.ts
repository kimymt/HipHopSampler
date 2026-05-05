/**
 * Shared domain types for the sampler.
 *
 * These describe the runtime objects that flow between hooks and components.
 * Keeping them in one file lets hooks/utilities import without circular deps.
 */

export interface Sample {
  buffer: AudioBuffer;
  sourceId: string;
  name: string;
  startTime: number;
  endTime: number;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  volume: number;
  pan: number;
  chopGroup?: string;
  chopIndex?: number;
}

export type SampleMap = Record<string, Sample | null | undefined>;

/**
 * IndexedDB schema (sampleStore.ts).
 * pads store: keyed by padId, holds the metadata needed to restore + a
 * pointer to the audio bytes in the audio store.
 */
export interface PadMetadata {
  padId: string;
  sourceId: string;
  name: string;
  startTime: number;
  endTime: number;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  volume: number;
  pan: number;
  chopGroup?: string;
  chopIndex?: number;
}

/** audio store: keyed by sourceId, holds raw bytes + mime hint. */
export interface AudioStoreEntry {
  sourceId: string;
  arrayBuffer: ArrayBuffer;
  mimeType: string;
  savedAt: number;
}

export interface RestoreState {
  status: 'idle' | 'restoring' | 'ready' | 'error';
  progress: number;
  total: number;
  error: string | null;
}
