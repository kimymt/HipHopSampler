/**
 * Reference Mode (Phase 3 of "songcraft guidance" effort).
 *
 * Validates user-supplied audio files for the Reference Mode feature, which
 * lets a beginner load a track they like and overlay BPM + beat positions
 * as a learning aid. Strict copyright guardrails (per dev brief §2):
 *
 *   - 100% local processing, no upload
 *   - No persistence of the audio bytes themselves
 *   - DRM-protected files are rejected, not bypassed
 *
 * decodeAudioData throws an opaque DOMException for any decode failure,
 * including DRM. We can't tell DRM from "corrupt" or "unsupported codec"
 * just from the error — so we surface a useful message that covers all
 * three cases and asks the user to try a different file.
 */

export type ImportError =
  | { kind: 'too-large'; sizeMB: number; limitMB: number }
  | { kind: 'unsupported-extension'; ext: string }
  | { kind: 'decode-failed'; underlying: string }
  | { kind: 'empty' }
  | { kind: 'no-audio-context' };

export interface ImportSuccess {
  buffer: AudioBuffer;
  fileName: string;
  durationSec: number;
}

export type ImportResult =
  | { ok: true; data: ImportSuccess }
  | { ok: false; error: ImportError };

/** Hard cap. Refusing 100MB+ files protects against memory blow-ups on mobile. */
const MAX_FILE_BYTES = 100 * 1024 * 1024;

/** Codecs we will *attempt* to decode. The Web Audio decoder may still
 * refuse formats outside this list (codec-dependent), but if the file
 * extension isn't even on the list we save the user a long decode wait. */
const ACCEPTED_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'webm', 'opus']);

const getExtension = (fileName: string): string => {
  const idx = fileName.lastIndexOf('.');
  if (idx < 0 || idx >= fileName.length - 1) return '';
  return fileName.slice(idx + 1).toLowerCase();
};

/**
 * Validate + decode a user-selected file in one shot. The AudioBuffer is
 * held in memory only — we never persist it (per Reference Mode rules).
 */
export const importReferenceFile = async (
  file: File,
  ctx: AudioContext,
): Promise<ImportResult> => {
  if (!ctx) {
    return { ok: false, error: { kind: 'no-audio-context' } };
  }

  if (file.size === 0) {
    return { ok: false, error: { kind: 'empty' } };
  }

  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: {
        kind: 'too-large',
        sizeMB: file.size / 1024 / 1024,
        limitMB: MAX_FILE_BYTES / 1024 / 1024,
      },
    };
  }

  const ext = getExtension(file.name);
  if (!ACCEPTED_EXTENSIONS.has(ext)) {
    return { ok: false, error: { kind: 'unsupported-extension', ext: ext || 'unknown' } };
  }

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (err) {
    return {
      ok: false,
      error: { kind: 'decode-failed', underlying: err instanceof Error ? err.message : 'read failed' },
    };
  }

  try {
    // decodeAudioData is the single chokepoint. DRM-protected files (e.g. a
    // file ripped with DRM intact, Apple Music protected M4A) throw here.
    // We do NOT attempt to bypass — caller surfaces a "try a different file"
    // message. This is what makes the feature legally defensible.
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    return {
      ok: true,
      data: {
        buffer,
        fileName: file.name,
        durationSec: buffer.duration,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: 'decode-failed',
        underlying: err instanceof Error ? err.message : String(err),
      },
    };
  }
};

/**
 * Map an ImportError to a user-facing Japanese message. Phrased so it works
 * for DRM, corrupt files, and unsupported codecs without naming "DRM"
 * specifically (we can't tell from the error which one it actually was).
 */
export const errorMessage = (error: ImportError): string => {
  switch (error.kind) {
    case 'too-large':
      return `ファイルが大きすぎます (${error.sizeMB.toFixed(1)}MB)。${error.limitMB}MB 以下のファイルを使ってください。`;
    case 'unsupported-extension':
      return `「.${error.ext}」 形式は対応していません。MP3 / WAV / OGG / M4A / FLAC をお試しください。`;
    case 'decode-failed':
      return 'このファイルは解析できません。著作権保護 (DRM) がかかっているか、破損している可能性があります。別のファイルでお試しください。';
    case 'empty':
      return '空のファイルです。中身のあるオーディオファイルを選んでください。';
    case 'no-audio-context':
      return 'オーディオが初期化されていません。一度パッドをタップしてから再試行してください。';
  }
};
