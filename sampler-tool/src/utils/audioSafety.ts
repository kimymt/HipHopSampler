export const MAX_AUDIO_FILE_BYTES = 32 * 1024 * 1024;
export const MAX_AUDIO_DURATION = 300;
export const MAX_AUDIO_PCM_BYTES = 64 * 1024 * 1024;
export const MAX_TOTAL_PCM_BYTES = 192 * 1024 * 1024;
const MAX_SAMPLE_RATE = 96_000;
const METADATA_TIMEOUT_MS = 10_000;

export class AudioSafetyError extends Error {}

export function validateAudioFileSize(file: Blob) {
  if (!Number.isFinite(file.size) || file.size <= 0) throw new AudioSafetyError('空の音声ファイルは読み込めません。');
  if (file.size > MAX_AUDIO_FILE_BYTES) throw new AudioSafetyError('ファイルが大きすぎます。32MB以下の音声を選んでください。');
}

const retained = new Map<object, Set<AudioBuffer>>();
export function retainAudio(owner: object, buffers: Iterable<AudioBuffer>) {
  const unique = new Set(buffers);
  if (unique.size) retained.set(owner, unique);
  else retained.delete(owner);
}
export function releaseAudio(owner: object) { retained.delete(owner); }
export const pcmBytes = (buffer: AudioBuffer) => buffer.length * buffer.numberOfChannels * 4;
export function retainedAudioBytes() {
  const unique = new Set<AudioBuffer>();
  for (const buffers of retained.values()) for (const buffer of buffers) unique.add(buffer);
  return [...unique].reduce((sum, buffer) => sum + pcmBytes(buffer), 0);
}

export function validateAudioShape(duration: number, channels: number, sampleRate: number) {
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_AUDIO_DURATION ||
      !Number.isInteger(channels) || channels < 1 || channels > 2 ||
      !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > MAX_SAMPLE_RATE) {
    throw new AudioSafetyError('5分以内・モノラルまたはステレオの音声を選んでください。対応サンプルレートは8〜96kHzです。');
  }
  // Reserve one extra second for codec padding and resampling before decoding.
  const bytes = Math.ceil((duration + 1) * sampleRate) * channels * 4;
  if (bytes > MAX_AUDIO_PCM_BYTES) throw new AudioSafetyError('展開後の音声が大きすぎます。短い音声を選んでください。');
  if (retainedAudioBytes() + bytes > MAX_TOTAL_PCM_BYTES) {
    throw new AudioSafetyError('音声の保持上限に達しました。不要なパッドや参考曲を削除してから再試行してください。');
  }
}

/** Ogg-FLAC is decoded by Web Audio but not exposed as a track by Mediabunny.
 * Read only Ogg page headers and the identification packet. Reject chained /
 * multiplexed streams so their durations cannot hide behind a single granule.
 */
export async function inspectOggFlac(file: Blob, outputSampleRate: number, cancelled = () => false) {
  let offset = 0, serial = -1, sequence = 0, channels = 0, rate = 0;
  let granule = 0n, ended = false;
  while (offset < file.size) {
    if (cancelled()) throw new AudioSafetyError('音声の確認が中断されました。');
    if (sequence >= 20_000) throw new AudioSafetyError('音声の構成を確認できません。別のファイルを選んでください。');
    const header = new Uint8Array(await file.slice(offset, offset + 282).arrayBuffer());
    if (header.length < 27 || String.fromCharCode(...header.subarray(0, 4)) !== 'OggS' || header[4] !== 0 || ended) throw new Error('Invalid Ogg page');
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    const count = header[26];
    if (header.length < 27 + count) throw new Error('Truncated Ogg page');
    const size = header.subarray(27, 27 + count).reduce((sum, n) => sum + n, 0);
    const payload = offset + 27 + count;
    if (payload + size > file.size || view.getUint32(18, true) !== sequence) throw new Error('Invalid Ogg sequence');
    if (sequence === 0) {
      if (!(header[5] & 2) || header[27] < 51) throw new Error('Missing Ogg-FLAC identification');
      serial = view.getUint32(14, true);
      const id = new Uint8Array(await file.slice(payload, payload + 51).arrayBuffer());
      if (id.length < 51 || id[0] !== 0x7f || String.fromCharCode(...id.subarray(1, 5)) !== 'FLAC' ||
          id[5] !== 1 || id[6] !== 0 || String.fromCharCode(...id.subarray(9, 13)) !== 'fLaC' ||
          (id[13] & 0x7f) !== 0 || id[14] !== 0 || id[15] !== 0 || id[16] !== 34) throw new Error('Unsupported Ogg codec');
      // STREAMINFO starts at byte 17; its packed rate/channels begin at byte 10.
      rate = (id[27] << 12) | (id[28] << 4) | (id[29] >> 4);
      channels = ((id[29] >> 1) & 7) + 1;
    }
    if (view.getUint32(14, true) !== serial || (sequence > 0 && (header[5] & 2))) throw new Error('Multiple Ogg streams');
    const position = view.getBigUint64(6, true);
    if (position !== 0xffffffffffffffffn) {
      if (position < granule || position > BigInt(MAX_AUDIO_DURATION * MAX_SAMPLE_RATE)) throw new AudioSafetyError('音声が長すぎます。5分以内の音声を選んでください。');
      granule = position;
    }
    ended = !!(header[5] & 4);
    offset = payload + size; sequence++;
  }
  if (!ended) throw new Error('Incomplete Ogg stream');
  validateAudioShape(Number(granule) / rate, channels, Math.max(rate, outputSampleRate));
}

/** Parse the container without invoking an audio decoder or trusting the extension. */
export async function inspectAudio(file: Blob, outputSampleRate: number) {
  validateAudioFileSize(file);
  const { ALL_FORMATS, BlobSource, Input } = await import('mediabunny');
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  let timer: ReturnType<typeof setTimeout>;
  let cancelled = false;
  try {
    await Promise.race([
      (async () => {
        const tracks = await input.getAudioTracks();
        if (tracks.length === 0) return inspectOggFlac(file, outputSampleRate, () => cancelled);
        if (tracks.length !== 1) throw new AudioSafetyError('音声トラックが1つのファイルを選んでください。');
        const track = tracks[0];
        const [duration, channels, rate] = await Promise.all([
          track.computeDuration(), track.getNumberOfChannels(), track.getSampleRate(),
        ]);
        validateAudioShape(duration, channels, Math.max(rate, outputSampleRate));
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new AudioSafetyError('音声の確認が時間切れになりました。別のファイルを選んでください。')), METADATA_TIMEOUT_MS);
      }),
    ]);
  } finally {
    cancelled = true;
    clearTimeout(timer!);
    input.dispose();
  }
}

// Shared by sample import, startup restore and Reference Mode. Keep the reservation
// through consume(), including persistence, so another decoder cannot steal it.
let decodeQueue: Promise<unknown> = Promise.resolve();
export function withDecodedAudio<T>(
  file: Blob,
  ctx: AudioContext,
  consume: (buffer: AudioBuffer, bytes: ArrayBuffer) => Promise<T> | T,
  isCurrent: () => boolean = () => true,
): Promise<T | undefined> {
  // Reject oversized files before retaining them in the queue.
  try { validateAudioFileSize(file); } catch (error) { return Promise.reject(error); }
  const run = decodeQueue.then(async () => {
    if (!isCurrent()) return;
    await inspectAudio(file, ctx.sampleRate);
    if (!isCurrent()) return;
    const bytes = await file.arrayBuffer();
    if (!isCurrent()) return;
    const buffer = await ctx.decodeAudioData(bytes.slice(0));
    if (!isCurrent()) return;
    validateAudioShape(buffer.duration, buffer.numberOfChannels, buffer.sampleRate);
    return consume(buffer, bytes);
  });
  decodeQueue = run.catch(() => {});
  return run;
}
