/**
 * AudioBuffer → 16-bit PCM WAV Blob.
 *
 * Used by synthDrums.ts to push generated drum samples through the same
 * loadSample pipeline as user-uploaded files (which expects File/Blob,
 * not raw AudioBuffer). 16-bit PCM is the universal lowest-common-denominator
 * format that all browsers can decode without question.
 *
 * Mono only — the synth recipes we have are all single-channel. If we ever
 * synthesize stereo content, extend this to interleave channels.
 */
export const encodeWav = (buffer: AudioBuffer): Blob => {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.getChannelData(0);
  const numSamples = samples.length;
  const byteRate = sampleRate * numChannels * 2; // 16-bit = 2 bytes/sample
  const dataSize = numSamples * numChannels * 2;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt subchunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // format = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, numChannels * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample

  // data subchunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM samples — clamp [-1, 1] then scale to int16.
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
};

const writeString = (view: DataView, offset: number, str: string) => {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
};
