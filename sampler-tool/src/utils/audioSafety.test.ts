/// <reference types="node" />
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import { inspectAudio, withDecodedAudio, validateAudioShape, MAX_AUDIO_FILE_BYTES, MAX_TOTAL_PCM_BYTES, retainAudio, releaseAudio, retainedAudioBytes } from './audioSafety';

function wav(channels = 1, sampleRate = 8000, frames = 800) {
  const data = new ArrayBuffer(44 + frames * channels * 2);
  const view = new DataView(data);
  const text = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, data.byteLength - 8, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, data.byteLength - 44, true);
  return new Blob([data], { type: 'audio/wav' });
}
const decoded = () => ({ length: 800, numberOfChannels: 1, sampleRate: 8000, duration: 0.1 } as AudioBuffer);

describe('audio import security limits', () => {
  it('parses real WAV metadata without decoding', async () => {
    await expect(inspectAudio(wav(), 44100)).resolves.toBeUndefined();
  });
  it('accepts a real Ogg-FLAC file while rejecting truncated or chained streams', async () => {
    // Fixture: ffmpeg -f lavfi -i sine=frequency=440:sample_rate=44100 -t 0.3 -c:a flac tone.ogg
    const bytes = readFileSync(new URL('./fixtures/tone.ogg', import.meta.url));
    await expect(inspectAudio(new Blob([bytes]), 44100)).resolves.toBeUndefined();
    await expect(inspectAudio(new Blob([bytes.subarray(0, bytes.length - 10)]), 44100)).rejects.toThrow();
    await expect(inspectAudio(new Blob([bytes, bytes]), 44100)).rejects.toThrow();
  });
  it('refuses huge input before reading bytes or starting the decoder', async () => {
    const file = { size: MAX_AUDIO_FILE_BYTES + 1, arrayBuffer: vi.fn() } as unknown as Blob;
    const ctx = { sampleRate: 44100, decodeAudioData: vi.fn() } as unknown as AudioContext;
    await expect(withDecodedAudio(file, ctx, vi.fn())).rejects.toThrow('32MB');
    expect(file.arrayBuffer).not.toHaveBeenCalled(); expect(ctx.decodeAudioData).not.toHaveBeenCalled();
  });
  it('rejects corrupt files and excessive channels before decoding', async () => {
    const ctx = { sampleRate: 44100, decodeAudioData: vi.fn() } as unknown as AudioContext;
    await expect(withDecodedAudio(new Blob(['not audio']), ctx, vi.fn())).rejects.toThrow();
    await expect(withDecodedAudio(wav(8), ctx, vi.fn())).rejects.toThrow('ステレオ');
    expect(ctx.decodeAudioData).not.toHaveBeenCalled();
  });
  it('rejects long durations and oversized PCM independently of encoded bytes', () => {
    expect(() => validateAudioShape(301, 1, 8000)).toThrow();
    expect(() => validateAudioShape(300, 2, 96000)).toThrow('展開後');
  });
  it('rejects oversized decoded PCM before consumption despite small valid metadata', async () => {
    const decodeAudioData = vi.fn(async () => ({
      duration: 300, length: 300 * 96_000, numberOfChannels: 2, sampleRate: 96_000,
    } as AudioBuffer));
    const ctx = { sampleRate: 8000, decodeAudioData } as unknown as AudioContext;
    const consume = vi.fn();
    await expect(withDecodedAudio(wav(), ctx, consume)).rejects.toThrow('展開後');
    expect(decodeAudioData).toHaveBeenCalledTimes(1);
    expect(consume).not.toHaveBeenCalled();
  });
  it('serializes decode and persistence callbacks across all callers', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const decode = vi.fn(async () => decoded());
    const ctx = { sampleRate: 8000, decodeAudioData: decode } as unknown as AudioContext;
    let consuming = false;
    const a = withDecodedAudio(wav(), ctx, async () => { consuming = true; await gate; });
    await vi.waitFor(() => expect(consuming).toBe(true));
    const b = withDecodedAudio(wav(), ctx, () => 'second');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(decode).toHaveBeenCalledTimes(1);
    release(); await a; await expect(b).resolves.toBe('second');
  });
  it('deduplicates chopped buffers and includes reference audio in the shared budget', async () => {
    const samples = {}, reference = {};
    const buffer = { length: MAX_TOTAL_PCM_BYTES / 4, numberOfChannels: 1 } as AudioBuffer;
    try {
      retainAudio(samples, [buffer, buffer]); retainAudio(reference, [buffer]);
      expect(retainedAudioBytes()).toBe(MAX_TOTAL_PCM_BYTES);
      await expect(inspectAudio(wav(), 44100)).rejects.toThrow('保持上限');
      releaseAudio(samples); expect(retainedAudioBytes()).toBe(MAX_TOTAL_PCM_BYTES);
    } finally { releaseAudio(samples); releaseAudio(reference); }
    expect(retainedAudioBytes()).toBe(0);
  });
  it('does not retain or persist a decoder result canceled in flight', async () => {
    let resolve!: (b: AudioBuffer) => void;
    let current = true;
    const ctx = { sampleRate: 8000, decodeAudioData: vi.fn(() => new Promise<AudioBuffer>((r) => { resolve = r; })) } as unknown as AudioContext;
    const consume = vi.fn();
    const pending = withDecodedAudio(wav(), ctx, consume, () => current);
    await vi.waitFor(() => expect(ctx.decodeAudioData).toHaveBeenCalled());
    current = false; resolve(decoded()); await pending;
    expect(consume).not.toHaveBeenCalled();
  });
});
