import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReferenceTrack } from './useReferenceTrack';
import { retainedAudioBytes, withDecodedAudio } from '../utils/audioSafety';
import { analyzeReferenceTrack, type ReferenceAnalysis } from '../utils/analyzeReference';

vi.mock('../utils/audioSafety', async (original) => ({
  ...await original<typeof import('../utils/audioSafety')>(),
  withDecodedAudio: vi.fn(),
}));
vi.mock('../utils/analyzeReference', () => ({ analyzeReferenceTrack: vi.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}
const buffer = () => ({ duration: 1, length: 8000, numberOfChannels: 1, sampleRate: 8000 } as AudioBuffer);
const file = (name: string) => new File(['audio'], name, { type: 'audio/wav' });
const analysis = {} as ReferenceAnalysis;
const ctx = {} as AudioContext;

beforeEach(() => { vi.resetAllMocks(); });
afterEach(() => { cleanup(); expect(retainedAudioBytes()).toBe(0); });

describe('reference import cancellation', () => {
  it.each(['clear', 'unmount'])('does not retain a late decoder result after %s', async (action) => {
    const decoding = deferred<AudioBuffer>();
    vi.mocked(withDecodedAudio).mockImplementation(async (_file, _ctx, consume, isCurrent) => {
      const decoded = await decoding.promise;
      if (isCurrent?.()) return consume(decoded, new ArrayBuffer(0));
    });
    const hook = renderHook(() => useReferenceTrack({ initAudioContext: () => ctx }));
    let pending!: Promise<void>;
    act(() => { pending = hook.result.current.importFile(file('old.wav')); });
    expect(hook.result.current.state.status).toBe('importing');
    if (action === 'clear') act(() => hook.result.current.clear());
    else hook.unmount();
    await act(async () => { decoding.resolve(buffer()); await pending; });
    expect(retainedAudioBytes()).toBe(0);
    expect(analyzeReferenceTrack).not.toHaveBeenCalled();
    if (action === 'clear') expect(hook.result.current.state.status).toBe('idle');
  });

  it('ignores old analysis after a newer reference becomes ready', async () => {
    vi.mocked(withDecodedAudio).mockImplementation(async (_file, _ctx, consume, isCurrent) => {
      if (isCurrent?.()) return consume(buffer(), new ArrayBuffer(0));
    });
    const oldAnalysis = deferred<ReferenceAnalysis>();
    vi.mocked(analyzeReferenceTrack).mockReturnValueOnce(oldAnalysis.promise).mockResolvedValueOnce(analysis);
    const hook = renderHook(() => useReferenceTrack({ initAudioContext: () => ctx }));
    let old!: Promise<void>;
    await act(async () => { old = hook.result.current.importFile(file('old.wav')); });
    expect(hook.result.current.state.status).toBe('analyzing');
    await act(async () => { await hook.result.current.importFile(file('new.wav')); });
    const current = hook.result.current.state;
    expect(current.status).toBe('ready');
    if (current.status === 'ready') expect(current.track.fileName).toBe('new.wav');
    expect(retainedAudioBytes()).toBe(32_000);
    await act(async () => { oldAnalysis.resolve(analysis); await old; });
    expect(hook.result.current.state).toBe(current);
    expect(retainedAudioBytes()).toBe(32_000);
    act(() => hook.result.current.clear());
    expect(hook.result.current.state.status).toBe('idle');
    expect(retainedAudioBytes()).toBe(0);
  });
});
