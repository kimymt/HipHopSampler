import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useAudioEngine } from './useAudioEngine';
import { retainAudio, releaseAudio, retainedAudioBytes } from '../utils/audioSafety';
afterEach(cleanup);
it('counts replaced audio until playback actually ends', () => {
  const source = { start: vi.fn(), stop: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), onended: null as Function | null, buffer: null };
  const ctx = {
    currentTime: 0, destination: {}, createBufferSource: () => source,
    createGain: () => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }),
    createStereoPanner: () => ({ pan: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }),
  };
  const buffer = { length: 8000, numberOfChannels: 1, duration: 1 } as AudioBuffer;
  const owner = {};
  retainAudio(owner, [buffer]);
  const { result } = renderHook(() => useAudioEngine(() => ctx, undefined));
  act(() => { result.current.trigger({ buffer }); });
  releaseAudio(owner); // pad replaced/removed while its old source is playing
  expect(retainedAudioBytes()).toBe(32000);
  act(() => { result.current.stopAll(); });
  expect(retainedAudioBytes()).toBe(32000);
  source.onended?.();
  expect(retainedAudioBytes()).toBe(0);
});
